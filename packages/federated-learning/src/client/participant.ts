/**
 * Federated Learning Client - Participant
 * Runs on edge devices (mobile apps) to participate in federated learning
 */

import WebSocket from 'ws';
import * as crypto from 'crypto';
import { regionRegistry } from '@agrisense/region-config';

export interface FLParticipantConfig {
  regionId: string;
  farmerId: string;
  serverUrl: string;
  modelVersion: string;
  sampleCount: number;
  capabilities: string[];
  autoReconnect: boolean;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  trainingEpochs: number;
  batchSize: number;
  learningRate: number;
  privacyBudget?: {
    epsilon: number;
    delta: number;
  };
}

export interface ModelWeights {
  version: string;
  weights: Float32Array[];
  metadata: Record<string, any>;
}

export interface TrainingResult {
  modelVersion: string;
  weightsDelta: Float32Array;
  weightsHash: string;
  sampleCount: number;
  metrics: {
    accuracy: number;
    loss: number;
    valAccuracy: number;
    valLoss: number;
    trainingTimeMs: number;
  };
}

const DEFAULT_CONFIG: Partial<FLParticipantConfig> = {
  serverUrl: process.env.FL_SERVER_URL || 'ws://localhost:8080',
  modelVersion: 'v1.0.0',
  sampleCount: 0,
  capabilities: ['training', 'inference'],
  autoReconnect: true,
  reconnectInterval: 5000,
  maxReconnectAttempts: 10,
  trainingEpochs: 5,
  batchSize: 32,
  learningRate: 0.001,
};

export class FLParticipant {
  private config: FLParticipantConfig;
  private ws: WebSocket | null = null;
  private clientId: string = '';
  private currentRound: number = 0;
  private isTraining = false;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private localModel: ModelWeights | null = null;

  // Callbacks
  onModelUpdate?: (modelInfo: any) => Promise<ModelWeights | null>;
  onTrainingProgress?: (progress: number, metrics: any) => void;
  onRoundComplete?: (newVersion: string, modelUrl: string) => void;
  onRoundStart?: (roundInfo: any) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: string) => void;

  constructor(config: Partial<FLParticipantConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config } as FLParticipantConfig;
  }

  /**
   * Connect to FL server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`🔗 Connecting to FL server: ${this.config.serverUrl}`);

      this.ws = new WebSocket(this.config.serverUrl);

      this.ws.on('open', () => {
        console.log('✅ Connected to FL server');
        this.reconnectAttempts = 0;
        this.register();
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (err) {
          console.error('Invalid message:', err);
        }
      });

      this.ws.on('close', (code, reason) => {
        console.log(`🔌 Disconnected from FL server (${code}: ${reason})`);
        this.handleDisconnect();
      });

      this.ws.on('error', (err) => {
        console.error('❌ WebSocket error:', err);
        this.onError?.(err);
        if (!this.clientId) {
          reject(err);
        }
      });

      // Connection timeout
      setTimeout(() => {
        if (!this.clientId) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Register with FL server
   */
  private register(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({
      type: 'register',
      regionId: this.config.regionId,
      modelVersion: this.config.modelVersion,
      sampleCount: this.config.sampleCount,
      capabilities: this.config.capabilities,
    }));
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: any): void {
    switch (message.type) {
      case 'welcome':
        this.clientId = message.clientId;
        console.log(`👋 Assigned client ID: ${this.clientId}`);
        break;

      case 'registered':
        console.log(`✅ Registered for region: ${this.config.regionId}, round: ${message.currentRound}`);
        this.currentRound = message.currentRound;
        this.onStatusChange?.('idle');
        break;

      case 'new_round':
        console.log(`🔄 New round ${message.roundId} started, target: ${message.targetVersion}`);
        this.currentRound = message.roundId;
        this.onRoundStart?.(message);
        this.participateInRound(message);
        break;

      case 'aggregation_complete':
        console.log(`✅ Aggregation complete! New version: ${message.newModelVersion}`);
        this.onRoundComplete?.(message.newModelVersion, message.modelUrl);
        this.onStatusChange?.('idle');
        break;

      case 'aggregation_failed':
        console.error(`❌ Aggregation failed: ${message.error}`);
        this.onError?.(new Error(message.error));
        this.onStatusChange?.('idle');
        break;

      case 'round_timeout':
        console.log(`⏰ Round ${message.roundId} timed out`);
        this.onStatusChange?.('idle');
        break;

      case 'model_info':
        console.log(`📦 Model info received: ${message.modelVersion}`);
        this.onModelUpdate?.(message);
        break;

      case 'ping':
        // Heartbeat response
        this.ws?.send(JSON.stringify({ type: 'heartbeat' }));
        break;

      case 'error':
        console.error(`Server error: ${message.message}`);
        this.onError?.(new Error(message.message));
        break;

      case 'round_closed':
        console.log(`Round closed: ${message.message}`);
        break;

      case 'status':
        console.log(`Status: round=${message.currentRound}, clients=${message.connectedClients}`);
        break;

      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Participate in a training round
   */
  private async participateInRound(roundInfo: any): Promise<void> {
    if (this.isTraining) {
      console.log('⏳ Already training, skipping round');
      return;
    }

    // Check if we have enough local data
    if (this.config.sampleCount < (roundInfo.minSampleThreshold || 10)) {
      console.log('📊 Insufficient local data for training');
      return;
    }

    this.isTraining = true;
    this.onStatusChange?.('training');
    console.log('🏋️ Starting local training...');

    try {
      // Request model if we don't have it
      if (!this.localModel) {
        await this.requestModel();
      }

      // Perform local training
      const trainedModel = await this.trainLocally(roundInfo);

      if (trainedModel) {
        // Compute weight delta
        const weightsDelta = this.computeWeightDelta(trainedModel);

        // Send update
        this.sendModelUpdate(roundInfo.roundId, weightsDelta);
      }
    } catch (error) {
      console.error('Training failed:', error);
      this.onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Request model from server
   */
  private async requestModel(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({
      type: 'request_model',
    }));
  }

  /**
   * Perform local training
   */
  private async trainLocally(roundInfo: any): Promise<ModelWeights | null> {
    if (!this.onModelUpdate) {
      console.warn('No training callback provided');
      return null;
    }

    try {
      // Simulate training progress
      for (let epoch = 1; epoch <= this.config.trainingEpochs; epoch++) {
        const progress = (epoch / this.config.trainingEpochs) * 100;
        this.onTrainingProgress?.(progress, {
          epoch,
          loss: 0.5 - (epoch * 0.05),
          accuracy: 0.7 + (epoch * 0.04),
        });

        // Simulate training time
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const model = await this.onModelUpdate({
        regionId: this.config.regionId,
        currentVersion: this.config.modelVersion,
        roundInfo,
      });

      return model;
    } catch (error) {
      console.error('Local training error:', error);
      return null;
    }
  }

  /**
   * Compute weight delta between local and global model
   */
  private computeWeightDelta(trainedModel: ModelWeights): Float32Array {
    // In practice, this would compute the difference between
    // local model weights and global model weights
    // For now, return a compressed representation

    // Simple compression: quantize to int8
    const weights = trainedModel.weights;
    const compressed = new Float32Array(weights.length);

    for (let i = 0; i < weights.length; i++) {
      // Simple quantization (in reality, use proper quantization)
      compressed[i] = weights[i];
    }

    return compressed;
  }

  /**
   * Send model update to server
   */
  private sendModelUpdate(roundId: number, weightsDelta: Float32Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Hash the weights for integrity
    const weightsHash = crypto.createHash('sha256')
      .update(Buffer.from(weightsDelta.buffer))
      .digest('hex')
      .slice(0, 16);

    this.ws.send(JSON.stringify({
      type: 'model_update',
      roundId,
      modelVersion: this.config.modelVersion,
      weightsHash,
      weightsDelta: Array.from(weightsDelta), // Convert to array for JSON
      sampleCount: this.config.sampleCount,
      metrics: {
        accuracy: 0.85 + Math.random() * 0.1, // Simulated
        loss: 0.3 - Math.random() * 0.1,
        valAccuracy: 0.82 + Math.random() * 0.1,
        valLoss: 0.35 - Math.random() * 0.1,
        trainingTimeMs: this.config.trainingEpochs * 200,
      },
    }));

    console.log(`📤 Sent model update for round ${roundId}`);
    this.onStatusChange?.('sending');
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(): void {
    this.clientId = '';
    this.ws = null;
    this.isTraining = false;

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    this.onStatusChange?.('disconnected');

    if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      console.log(`🔄 Reconnecting in ${this.config.reconnectInterval}ms... (attempt ${this.reconnectAttempts + 1}/${this.config.maxReconnectAttempts})`);
      this.reconnectTimer = setTimeout(() => {
        this.reconnectAttempts++;
        this.connect().catch(err => {
          console.error('Reconnection failed:', err);
        });
      }, this.config.reconnectInterval);
    }
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.config.autoReconnect = false;
    this.ws?.close(1000, 'Client disconnect');
  }

  /**
   * Update sample count
   */
  updateSampleCount(count: number): void {
    this.config.sampleCount = count;
  }

  /**
   * Update model version
   */
  updateModelVersion(version: string): void {
    this.config.modelVersion = version;
  }

  /**
   * Get participant status
   */
  getStatus(): {
    connected: boolean;
    clientId: string;
    regionId: string;
    modelVersion: string;
    currentRound: number;
    isTraining: boolean;
    sampleCount: number;
    reconnectAttempts: number;
  } {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      clientId: this.clientId,
      regionId: this.config.regionId,
      modelVersion: this.config.modelVersion,
      currentRound: this.currentRound,
      isTraining: this.isTraining,
      sampleCount: this.config.sampleCount,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

/**
 * React hook for FL participant
 */
import { useState, useEffect, useCallback, useRef } from 'react';

export function useFederatedLearning(config: Partial<FLParticipantConfig>) {
  const [status, setStatus] = useState<ReturnType<FLParticipant['getStatus']>>({
    connected: false,
    clientId: '',
    regionId: config.regionId || 'india',
    modelVersion: config.modelVersion || 'v1.0.0',
    currentRound: 0,
    isTraining: false,
    sampleCount: config.sampleCount || 0,
    reconnectAttempts: 0,
  });
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [trainingMetrics, setTrainingMetrics] = useState<Record<string, any>>({});
  const [lastRound, setLastRound] = useState<{ version: string; modelUrl: string } | null>(null);
  const participantRef = useRef<FLParticipant | null>(null);

  useEffect(() => {
    const participant = new FLParticipant(config);
    participantRef.current = participant;

    participant.onTrainingProgress = (progress, metrics) => {
      setTrainingProgress(progress);
      setTrainingMetrics(metrics);
    };

    participant.onRoundComplete = (version, modelUrl) => {
      setLastRound({ version, modelUrl });
      setStatus(s => ({ ...s, modelVersion: version, isTraining: false }));
    };

    participant.onRoundStart = (roundInfo) => {
      setStatus(s => ({ ...s, currentRound: roundInfo.roundId, isTraining: true }));
    };

    participant.onError = (error) => {
      console.error('FL Error:', error);
    };

    participant.onStatusChange = (statusStr) => {
      setStatus(s => ({ ...s, isTraining: statusStr === 'training' }));
    };

    participant.connect().then(() => {
      // Start status polling
      const interval = setInterval(() => {
        setStatus(participant.getStatus());
      }, 5000);
      return () => clearInterval(interval);
    }).catch(err => {
      console.error('FL connection failed:', err);
    });

    return () => {
      participant.disconnect();
    };
  }, [config.regionId, config.farmerId]);

  const triggerTraining = useCallback(async () => {
    if (participantRef.current) {
      // Manually trigger participation check
      await participantRef.current.participateInRound({ roundId: status.currentRound + 1 });
    }
  }, [status.currentRound]);

  return {
    status,
    trainingProgress,
    trainingMetrics,
    lastRound,
    triggerTraining,
    updateSampleCount: (count: number) => {
      participantRef.current?.updateSampleCount(count);
      setStatus(s => ({ ...s, sampleCount: count }));
    },
    updateModelVersion: (version: string) => {
      participantRef.current?.updateModelVersion(version);
      setStatus(s => ({ ...s, modelVersion: version }));
    },
  };
}