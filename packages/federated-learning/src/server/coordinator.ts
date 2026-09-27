/**
 * Federated Learning Server - Coordinator
 * Manages FL rounds, client coordination, and model aggregation
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server } from 'http';
import * as crypto from 'crypto';
import { regionRegistry, loadAllRegionConfigs } from '@agrisense/region-config';

export interface ClientInfo {
  id: string;
  regionId: string;
  modelVersion: string;
  ws: WebSocket;
  lastSeen: number;
  sampleCount: number;
  capabilities: string[];
  status: 'idle' | 'training' | 'sending' | 'completed' | 'disconnected';
  metrics?: {
    accuracy: number;
    loss: number;
    valAccuracy: number;
    valLoss: number;
    trainingTimeMs: number;
  };
}

export interface ModelUpdate {
  clientId: string;
  regionId: string;
  roundId: number;
  modelVersion: string;
  weightsHash: string;
  weightsDelta: Float32Array | number[];
  sampleCount: number;
  metrics: {
    accuracy: number;
    loss: number;
    valAccuracy: number;
    valLoss: number;
    trainingTimeMs: number;
  };
  timestamp: number;
}

export interface AggregationRound {
  roundId: number;
  regionId: string;
  targetVersion: string;
  globalModelHash: string;
  clients: Map<string, ModelUpdate>;
  startTime: number;
  timeout: number;
  minClients: number;
  requiredClients: number;
  status: 'waiting' | 'aggregating' | 'complete' | 'failed' | 'timeout';
  aggregatedModel?: any;
  newModelVersion?: string;
  newModelHash?: string;
}

export interface FLConfig {
  port: number;
  host: string;
  minClientsPerRound: number;
  maxClientsPerRound: number;
  roundTimeoutMs: number;
  aggregationAlgorithm: 'fedavg' | 'fedprox' | 'scaffold' | 'fedadam';
  minSampleThreshold: number;
  maxRounds: number;
  autoStartRounds: boolean;
  roundIntervalMs: number;
  checkpointDir: string;
  enablePrivacy: boolean;
  differentialPrivacyEpsilon: number;
  differentialPrivacyDelta: number;
}

const DEFAULT_CONFIG: FLConfig = {
  port: parseInt(process.env.FL_PORT || '8080', 10),
  host: process.env.FL_HOST || '0.0.0.0',
  minClientsPerRound: 3,
  maxClientsPerRound: 100,
  roundTimeoutMs: 300000, // 5 minutes
  aggregationAlgorithm: 'fedavg',
  minSampleThreshold: 10,
  maxRounds: 100,
  autoStartRounds: true,
  roundIntervalMs: 3600000, // 1 hour
  checkpointDir: './checkpoints',
  enablePrivacy: true,
  differentialPrivacyEpsilon: 1.0,
  differentialPrivacyDelta: 1e-5,
};

export class FLCoordinator {
  private config: FLConfig;
  private server: Server;
  private wss: WebSocketServer;
  private clients: Map<string, ClientInfo> = new Map();
  private rounds: Map<string, AggregationRound> = new Map();
  private currentRound: number = 0;
  private regionClients: Map<string, Set<string>> = new Map();
  private roundTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(config: Partial<FLConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.server = createServer();
    this.wss = new WebSocketServer({ server: this.server });
    this.setupWebSocket();
  }

  /**
   * Start the FL coordinator
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.config.port, this.config.host, () => {
        console.log(`🌐 FL Coordinator started on ${this.config.host}:${this.config.port}`);
        this.isRunning = true;
        this.startHeartbeat();
        if (this.config.autoStartRounds) {
          this.scheduleNextRound();
        }
        resolve();
      });
    });
  }

  /**
   * Stop the FL coordinator
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      client.ws.close(1001, 'Server shutting down');
    }

    await new Promise<void>((resolve) => {
      this.wss.close(() => {
        this.server.close(() => {
          console.log('🛑 FL Coordinator stopped');
          resolve();
        });
      });
    });
  }

  /**
   * Setup WebSocket handlers
   */
  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = crypto.randomUUID();
      const clientIP = req.socket.remoteAddress;
      console.log(`📱 Client connected: ${clientId} from ${clientIP}`);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(clientId, ws, message);
        } catch (err) {
          console.error('Invalid message:', err);
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
        }
      });

      ws.on('close', (code, reason) => {
        console.log(`📱 Client disconnected: ${clientId} (${code}: ${reason})`);
        this.handleDisconnect(clientId);
      });

      ws.on('error', (err) => {
        console.error(`Client ${clientId} error:`, err);
        this.handleDisconnect(clientId);
      });

      // Send welcome
      ws.send(JSON.stringify({
        type: 'welcome',
        clientId,
        serverTime: Date.now(),
        config: {
          minSampleThreshold: this.config.minSampleThreshold,
          aggregationAlgorithm: this.config.aggregationAlgorithm,
        },
      }));
    });
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(clientId: string, ws: WebSocket, message: any): void {
    switch (message.type) {
      case 'register':
        this.handleRegister(clientId, ws, message);
        break;
      case 'model_update':
        this.handleModelUpdate(clientId, message);
        break;
      case 'heartbeat':
        this.handleHeartbeat(clientId);
        break;
      case 'request_model':
        this.handleModelRequest(clientId, ws, message);
        break;
      case 'sync_complete':
        this.handleSyncComplete(clientId, message);
        break;
      case 'get_status':
        this.handleStatusRequest(clientId, ws);
        break;
      default:
        console.warn(`Unknown message type: ${message.type}`);
        ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${message.type}` }));
    }
  }

  /**
   * Handle client registration
   */
  private handleRegister(clientId: string, ws: WebSocket, message: any): void {
    const { regionId, modelVersion, sampleCount, capabilities } = message;

    // Validate region
    const region = regionRegistry.getRegion(regionId);
    if (!region) {
      ws.send(JSON.stringify({ type: 'error', message: `Unknown region: ${regionId}` }));
      ws.close(1008, 'Invalid region');
      return;
    }

    // Check sample count threshold
    if (sampleCount < this.config.minSampleThreshold) {
      ws.send(JSON.stringify({
        type: 'error',
        message: `Insufficient samples: ${sampleCount} < ${this.config.minSampleThreshold}`,
      }));
      ws.close(1008, 'Insufficient samples');
      return;
    }

    // Create client info
    const client: ClientInfo = {
      id: clientId,
      regionId,
      modelVersion,
      ws,
      lastSeen: Date.now(),
      sampleCount: sampleCount || 0,
      capabilities: capabilities || ['training', 'inference'],
      status: 'idle',
    };

    this.clients.set(clientId, client);

    // Track region clients
    if (!this.regionClients.has(regionId)) {
      this.regionClients.set(regionId, new Set());
    }
    this.regionClients.get(regionId)!.add(clientId);

    console.log(`✅ Client registered: ${clientId} (region: ${regionId}, version: ${modelVersion}, samples: ${sampleCount})`);

    // Check if we can start a round
    this.checkRoundStart(regionId);

    ws.send(JSON.stringify({
      type: 'registered',
      clientId,
      currentRound: this.currentRound,
      serverModelVersion: region.modelConfig.edgeModelVersion,
      minSampleThreshold: this.config.minSampleThreshold,
    }));
  }

  /**
   * Handle model update from client
   */
  private handleModelUpdate(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const update: ModelUpdate = {
      clientId,
      regionId: client.regionId,
      roundId: message.roundId || this.currentRound,
      modelVersion: message.modelVersion,
      weightsHash: message.weightsHash,
      weightsDelta: message.weightsDelta,
      sampleCount: message.sampleCount,
      metrics: message.metrics,
      timestamp: Date.now(),
    };

    // Find or create round
    const roundKey = `${client.regionId}_${message.roundId || this.currentRound}`;
    let round = this.rounds.get(roundKey);

    if (!round) {
      round = this.createRound(client.regionId, message.roundId || this.currentRound);
      this.rounds.set(roundKey, round);
    }

    // Validate client is part of this round
    if (round.clients.has(clientId)) {
      console.warn(`Duplicate update from client ${clientId} in round ${round.roundId}`);
      return;
    }

    // Check if round is still accepting updates
    if (round.status !== 'waiting') {
      ws.send(JSON.stringify({
        type: 'round_closed',
        message: `Round ${round.roundId} is no longer accepting updates`,
      }));
      return;
    }

    // Add update
    round.clients.set(clientId, update);
    client.status = 'completed';
    client.lastSeen = Date.now();
    client.metrics = update.metrics;

    console.log(`📥 Model update from ${clientId} (round ${round.roundId}, ${round.clients.size}/${round.requiredClients} clients)`);

    // Check if round is complete
    if (round.clients.size >= round.requiredClients) {
      this.aggregateRound(roundKey);
    }
  }

  /**
   * Handle heartbeat
   */
  private handleHeartbeat(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastSeen = Date.now();
      client.ws.send(JSON.stringify({ type: 'heartbeat_ack', timestamp: Date.now() }));
    }
  }

  /**
   * Handle model request
   */
  private handleModelRequest(clientId: string, ws: WebSocket, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const region = regionRegistry.getRegion(client.regionId);
    if (!region) return;

    ws.send(JSON.stringify({
      type: 'model_info',
      modelVersion: region.modelConfig.edgeModelVersion,
      modelUrl: region.modelConfig.edgeModelUrl,
      modelHash: region.modelConfig.edgeModelHash,
      inputSize: region.modelConfig.inputSize,
      confidenceThreshold: region.modelConfig.confidenceThreshold,
      topK: region.modelConfig.topK,
      labelsUrl: `${region.modelConfig.edgeModelUrl.replace(/\.[^.]+$/, '')}_labels.txt`,
    }));
  }

  /**
   * Handle sync completion
   */
  private handleSyncComplete(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    console.log(`✅ Sync complete for ${clientId}: ${message.status}`);
    client.status = 'idle';
    client.lastSeen = Date.now();
  }

  /**
   * Handle status request
   */
  private handleStatusRequest(clientId: string, ws: WebSocket): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const regionClients = this.getRegionClients(client.regionId);

    ws.send(JSON.stringify({
      type: 'status',
      clientId,
      regionId: client.regionId,
      currentRound: this.currentRound,
      activeRounds: Array.from(this.rounds.values()).filter(r =>
        r.status === 'waiting' || r.status === 'aggregating'
      ).length,
      connectedClients: regionClients.size,
      serverTime: Date.now(),
    }));
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      // Remove from region tracking
      const regionSet = this.regionClients.get(client.regionId);
      if (regionSet) {
        regionSet.delete(clientId);
        if (regionSet.size === 0) {
          this.regionClients.delete(client.regionId);
        }
      }

      console.log(`📱 Client disconnected: ${clientId}`);
      this.clients.delete(clientId);
    }
  }

  /**
   * Check if we can start a new round for a region
   */
  private checkRoundStart(regionId: string): void {
    const regionClients = this.getRegionClients(regionId);
    const eligibleClients = Array.from(regionClients)
      .map(id => this.clients.get(id))
      .filter(c => c && c.sampleCount >= this.config.minSampleThreshold && c.status === 'idle');

    if (eligibleClients.length >= this.config.minClientsPerRound) {
      const now = Date.now();
      const lastRound = this.getLastRoundForRegion(regionId);

      if (!lastRound || now - lastRound.startTime >= this.config.roundIntervalMs) {
        this.startNewRound(regionId);
      }
    }
  }

  /**
   * Start a new FL round for a region
   */
  private startNewRound(regionId: string): void {
    this.currentRound++;
    const roundKey = `${regionId}_${this.currentRound}`;

    const region = regionRegistry.getRegion(regionId);
    if (!region) return;

    const regionClients = this.getRegionClients(regionId);
    const eligibleClients = Array.from(regionClients)
      .map(id => this.clients.get(id))
      .filter(c => c && c.sampleCount >= this.config.minSampleThreshold && c.status === 'idle')
      .slice(0, this.config.maxClientsPerRound);

    if (eligibleClients.length < this.config.minClientsPerRound) {
      console.log(`⚠️ Not enough eligible clients for ${regionId}: ${eligibleClients.length}`);
      return;
    }

    const round: AggregationRound = {
      roundId: this.currentRound,
      regionId,
      targetVersion: region.modelConfig.edgeModelVersion,
      globalModelHash: region.modelConfig.edgeModelHash,
      clients: new Map(),
      startTime: Date.now(),
      timeout: this.config.roundTimeoutMs,
      minClients: this.config.minClientsPerRound,
      requiredClients: Math.min(eligibleClients.length, this.config.maxClientsPerRound),
      status: 'waiting',
    };

    this.rounds.set(roundKey, round);

    // Update client status
    for (const client of eligibleClients) {
      if (client) client.status = 'training';
    }

    console.log(`🔄 Started round ${this.currentRound} for ${regionId} (${eligibleClients.length} clients)`);

    // Notify selected clients
    this.broadcastToClients(eligibleClients.map(c => c!.id), {
      type: 'new_round',
      roundId: this.currentRound,
      targetVersion: region.modelConfig.edgeModelVersion,
      globalModelHash: region.modelConfig.edgeModelHash,
      modelUrl: region.modelConfig.edgeModelUrl,
      deadline: Date.now() + this.config.roundTimeoutMs,
      minSampleThreshold: this.config.minSampleThreshold,
    });

    // Set timeout
    setTimeout(() => {
      const r = this.rounds.get(roundKey);
      if (r && r.status === 'waiting') {
        this.handleRoundTimeout(roundKey);
      }
    }, this.config.roundTimeoutMs);
  }

  /**
   * Create a round object
   */
  private createRound(regionId: string, roundId: number): AggregationRound {
    const region = regionRegistry.getRegion(regionId);
    if (!region) throw new Error(`Region not found: ${regionId}`);

    return {
      roundId,
      regionId,
      targetVersion: region.modelConfig.edgeModelVersion,
      globalModelHash: region.modelConfig.edgeModelHash,
      clients: new Map(),
      startTime: Date.now(),
      timeout: this.config.roundTimeoutMs,
      minClients: this.config.minClientsPerRound,
      requiredClients: this.config.maxClientsPerRound,
      status: 'waiting',
    };
  }

  /**
   * Handle round timeout
   */
  private handleRoundTimeout(roundKey: string): void {
    const round = this.rounds.get(roundKey);
    if (!round || round.status !== 'waiting') return;

    round.status = 'timeout';
    console.log(`⏰ Round ${round.roundId} for ${round.regionId} timed out (${round.clients.size}/${round.requiredClients} clients)`);

    // Notify clients
    this.broadcastToRegion(round.regionId, {
      type: 'round_timeout',
      roundId: round.roundId,
      message: 'Round timed out, not enough clients participated',
    });

    // Reset client status
    for (const clientId of round.clients.keys()) {
      const client = this.clients.get(clientId);
      if (client) client.status = 'idle';
    }
  }

  /**
   * Aggregate round updates using Federated Averaging
   */
  private async aggregateRound(roundKey: string): Promise<void> {
    const round = this.rounds.get(roundKey);
    if (!round || round.status !== 'waiting') return;

    round.status = 'aggregating';
    console.log(`⚙️ Aggregating round ${round.roundId} for ${round.regionId} (${round.clients.size} clients)`);

    try {
      const updates = Array.from(round.clients.values());
      const totalSamples = updates.reduce((sum, u) => sum + u.sampleCount, 0);

      // Perform Federated Averaging
      const aggregatedWeights = this.federatedAverage(updates, totalSamples);

      // Create new model version
      const newVersion = `${round.targetVersion}-fl${round.roundId}`;
      const newModelHash = crypto.createHash('sha256')
        .update(JSON.stringify(aggregatedWeights))
        .digest('hex')
        .slice(0, 16);

      round.status = 'complete';
      round.newModelVersion = newVersion;
      round.newModelHash = newModelHash;
      round.aggregatedModel = aggregatedWeights;

      // Save checkpoint
      await this.saveCheckpoint(round);

      // Notify all clients in region
      this.broadcastToRegion(round.regionId, {
        type: 'aggregation_complete',
        roundId: round.roundId,
        newModelVersion: newVersion,
        newModelHash,
        participatingClients: updates.length,
        totalSamples,
        modelUrl: `https://cdn.agrisense.app/models/${round.regionId}/${newVersion}.tflite`,
        modelHash: newModelHash,
      });

      console.log(`✅ Round ${round.roundId} complete. New version: ${newVersion}`);

      // Schedule next round
      if (this.isRunning) {
        this.scheduleNextRound(round.regionId);
      }

    } catch (error) {
      console.error(`❌ Aggregation failed for round ${round.roundId}:`, error);
      round.status = 'failed';

      this.broadcastToRegion(round.regionId, {
        type: 'aggregation_failed',
        roundId: round.roundId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Federated Averaging (FedAvg) - weighted by sample count
   */
  private federatedAverage(updates: ModelUpdate[], totalSamples: number): any {
    // In production, this would deserialize actual weight tensors
    // For now, simulate the aggregation
    console.log(`  Aggregating ${updates.length} updates with ${totalSamples} total samples`);

    // Weighted average by sample count
    const weights: Record<string, number> = {};
    for (const update of updates) {
      weights[update.clientId] = update.sampleCount / totalSamples;
    }

    return {
      version: updates[0].modelVersion,
      algorithm: this.config.aggregationAlgorithm,
      weights,
      aggregatedFrom: updates.map(u => u.clientId),
      totalSamples,
      timestamp: Date.now(),
    };
  }

  /**
   * Save checkpoint
   */
  private async saveCheckpoint(round: AggregationRound): Promise<void> {
    const checkpointDir = this.config.checkpointDir;
    if (!fs.existsSync(checkpointDir)) {
      fs.mkdirSync(checkpointDir, { recursive: true });
    }

    const checkpoint = {
      roundId: round.roundId,
      regionId: round.regionId,
      newModelVersion: round.newModelVersion,
      newModelHash: round.newModelHash,
      aggregatedModel: round.aggregatedModel,
      participatingClients: Array.from(round.clients.keys()),
      totalSamples: Array.from(round.clients.values()).reduce((sum, u) => sum + u.sampleCount, 0),
      timestamp: Date.now(),
    };

    const checkpointPath = path.join(checkpointDir, `round_${round.roundId}_${round.regionId}.json`);
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));

    console.log(`💾 Checkpoint saved: ${checkpointPath}`);
  }

  /**
   * Schedule next round for a region
   */
  private scheduleNextRound(regionId?: string): void {
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
    }

    this.roundTimer = setTimeout(() => {
      if (!this.isRunning) return;

      if (regionId) {
        this.checkRoundStart(regionId);
      } else {
        // Check all regions
        for (const regionId of this.regionClients.keys()) {
          this.checkRoundStart(regionId);
        }
      }
    }, this.config.roundIntervalMs);
  }

  /**
   * Start heartbeat timer
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();

      // Check client timeouts
      for (const [id, client] of this.clients.entries()) {
        if (now - client.lastSeen > 60000) { // 1 minute timeout
          console.log(`⏰ Client timeout: ${id}`);
          client.ws.close(1000, 'Heartbeat timeout');
          this.handleDisconnect(id);
        } else if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify({ type: 'ping', timestamp: now }));
        }
      }

      // Check for stale rounds
      for (const [key, round] of this.rounds.entries()) {
        if (round.status === 'waiting' && now - round.startTime > round.timeout) {
          console.log(`⏰ Round timeout: ${key}`);
          this.handleRoundTimeout(key);
        }
      }
    }, 10000); // Every 10 seconds
  }

  /**
   * Broadcast message to specific clients
   */
  private broadcastToClients(clientIds: string[], message: any): void {
    const data = JSON.stringify(message);
    for (const id of clientIds) {
      const client = this.clients.get(id);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    }
  }

  /**
   * Broadcast message to all clients in a region
   */
  private broadcastToRegion(regionId: string, message: any): void {
    const regionClients = this.getRegionClients(regionId);
    const data = JSON.stringify(message);

    for (const clientId of regionClients) {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    }
  }

  /**
   * Get all clients in a region
   */
  private getRegionClients(regionId: string): Set<string> {
    return this.regionClients.get(regionId) || new Set();
  }

  /**
   * Get last round for a region
   */
  private getLastRoundForRegion(regionId: string): AggregationRound | undefined {
    const regionRounds = Array.from(this.rounds.values())
      .filter(r => r.regionId === regionId)
      .sort((a, b) => b.startTime - a.startTime);
    return regionRounds[0];
  }

  /**
   * Get server statistics
   */
  getStats(): {
    totalClients: number;
    regionStats: Record<string, number>;
    activeRounds: number;
    completedRounds: number;
    failedRounds: number;
    currentRound: number;
  } {
    const regionStats: Record<string, number> = {};
    for (const [regionId, clients] of this.regionClients.entries()) {
      regionStats[regionId] = clients.size;
    }

    const rounds = Array.from(this.rounds.values());

    return {
      totalClients: this.clients.size,
      regionStats,
      activeRounds: rounds.filter(r => r.status === 'waiting' || r.status === 'aggregating').length,
      completedRounds: rounds.filter(r => r.status === 'complete').length,
      failedRounds: rounds.filter(r => r.status === 'failed' || r.status === 'timeout').length,
      currentRound: this.currentRound,
    };
  }

  /**
   * Get all rounds
   */
  getRounds(): AggregationRound[] {
    return Array.from(this.rounds.values());
  }

  /**
   * Get clients for a region
   */
  getRegionClientInfo(regionId: string): ClientInfo[] {
    const clientIds = this.getRegionClients(regionId);
    return Array.from(clientIds)
      .map(id => this.clients.get(id))
      .filter((c): c is ClientInfo => c !== undefined);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down...');
  process.exit(0);
});

// Start server if run directly
if (require.main === module) {
  const coordinator = new FLCoordinator();
  coordinator.start().catch(console.error);
}

export { FLCoordinator };
import * as fs from 'fs';
import * as path from 'path';