#!/usr/bin/env tsx
/**
 * Edge Model Training Script
 * Trains TensorFlow Lite models for on-device crop disease detection
 *
 * Usage:
 *   npm run train -- --region india --crop rice --epochs 50
 *
 * Requirements:
 * - Python environment with TensorFlow 2.x (for actual training)
 * - This script prepares data and config; actual training runs in Colab/local
 */

import * as fs from 'fs';
import * as path from 'path';
import { regionRegistry, loadAllRegionConfigs } from '@agrisense/region-config';

interface TrainConfig {
  region: string;
  crops: string[];
  epochs: number;
  batchSize: number;
  imageSize: number;
  architecture: 'efficientnet-b0' | 'mobilenetv3' | 'efficientnetv2-s';
  outputDir: string;
  dataDir: string;
  augment: boolean;
  quantize: boolean;
}

function parseArgs(): TrainConfig {
  const args = process.argv.slice(2);
  const config: TrainConfig = {
    region: 'india',
    crops: ['rice', 'wheat', 'maize', 'cotton', 'sugarcane', 'potato'],
    epochs: 50,
    batchSize: 32,
    imageSize: 224,
    architecture: 'efficientnet-b0',
    outputDir: './models',
    dataDir: './data',
    augment: true,
    quantize: true,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--region':
        config.region = args[++i];
        break;
      case '--crops':
        config.crops = args[++i].split(',');
        break;
      case '--epochs':
        config.epochs = parseInt(args[++i], 10);
        break;
      case '--batch-size':
        config.batchSize = parseInt(args[++i], 10);
        break;
      case '--image-size':
        config.imageSize = parseInt(args[++i], 10);
        break;
      case '--arch':
        config.architecture = args[++i] as any;
        break;
      case '--output':
        config.outputDir = args[++i];
        break;
      case '--data':
        config.dataDir = args[++i];
        break;
      case '--no-augment':
        config.augment = false;
        break;
      case '--no-quantize':
        config.quantize = false;
        break;
    }
  }

  return config;
}

async function generateTrainingConfig(config: TrainConfig) {
  // Load region config
  const regions = loadAllRegionConfigs(path.resolve(__dirname, '../../regions'));
  const region = regions.get(config.region);

  if (!region) {
    throw new Error(`Region not found: ${config.region}`);
  }

  // Filter crops
  const targetCrops = region.crops.filter(c => config.crops.includes(c.id));
  if (targetCrops.length === 0) {
    throw new Error(`No matching crops found for region ${config.region}`);
  }

  // Collect all disease classes
  const diseaseClasses = new Set<string>();
  const classMapping: Record<string, number> = {};
  let classIndex = 0;

  for (const crop of targetCrops) {
    const diseases = region.diseases.filter(d => d.cropIds.includes(crop.id));
    for (const disease of diseases) {
      const key = `${crop.id}_${disease.id}`;
      classMapping[key] = classIndex++;
      diseaseClasses.add(key);
    }
  }

  // Add healthy class
  classMapping['healthy'] = classIndex++;

  // Generate training configuration
  const trainConfig = {
    region: config.region,
    architecture: config.architecture,
    imageSize: config.imageSize,
    batchSize: config.batchSize,
    epochs: config.epochs,
    numClasses: classIndex,
    classMapping,
    crops: targetCrops.map(c => ({
      id: c.id,
      name: c.name,
      diseases: region.diseases
        .filter(d => d.cropIds.includes(c.id))
        .map(d => ({
          id: d.id,
          name: d.name,
          confidenceThreshold: d.confidenceThreshold,
        })),
    })),
    augmentation: config.augment ? {
      rotation: 20,
      widthShift: 0.2,
      heightShift: 0.2,
      shear: 0.2,
      zoom: 0.2,
      horizontalFlip: true,
      fillMode: 'nearest',
    } : null,
    quantization: config.quantize ? {
      type: 'int8',
      representativeDataset: 'generate_from_training_data',
    } : null,
    outputFormats: ['tflite', 'coreml', 'onnx'],
  };

  // Save config
  const outputPath = path.resolve(config.outputDir, `${config.region}_train_config.json`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(trainConfig, null, 2));

  console.log('✅ Training configuration generated:', outputPath);
  console.log(`📊 Classes: ${classIndex} (${diseaseClasses.size} diseases + healthy)`);
  console.log(`🌾 Crops: ${targetCrops.map(c => c.id).join(', ')}`);

  return trainConfig;
}

function generatePythonTrainingScript(config: TrainConfig, trainConfig: any) {
  const script = `# Edge Model Training for ${config.region}
# Generated automatically - run in Python environment with TensorFlow 2.x

import tensorflow as tf
import tensorflow.keras as keras
from tensorflow.keras import layers, models, callbacks
import numpy as np
import json
import os

# Load training config
with open('${config.region}_train_config.json') as f:
    cfg = json.load(f)

# Model architecture
def create_model(num_classes, image_size, architecture='efficientnet-b0'):
    if architecture == 'efficientnet-b0':
        base = keras.applications.EfficientNetB0(
            include_top=False,
            weights='imagenet',
            input_shape=(image_size, image_size, 3)
        )
    elif architecture == 'mobilenetv3':
        base = keras.applications.MobileNetV3Small(
            include_top=False,
            weights='imagenet',
            input_shape=(image_size, image_size, 3)
        )
    elif architecture == 'efficientnetv2-s':
        base = keras.applications.EfficientNetV2S(
            include_top=False,
            weights='imagenet',
            input_shape=(image_size, image_size, 3)
        )
    else:
        raise ValueError(f"Unknown architecture: {architecture}")

    base.trainable = False  # Freeze base initially

    inputs = keras.Input(shape=(image_size, image_size, 3))
    x = base(inputs, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(0.3)(x)
    x = layers.Dense(256, activation='relu')(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(0.2)(x)
    outputs = layers.Dense(num_classes, activation='softmax')(x)

    model = keras.Model(inputs, outputs)
    return model, base

# Data generators
def create_generators(data_dir, image_size, batch_size, augmentation):
    if augmentation:
        train_datagen = keras.preprocessing.image.ImageDataGenerator(
            rescale=1./255,
            rotation_range=augmentation['rotation'],
            width_shift_range=augmentation['widthShift'],
            height_shift_range=augmentation['heightShift'],
            shear_range=augmentation['shear'],
            zoom_range=augmentation['zoom'],
            horizontal_flip=augmentation['horizontalFlip'],
            fill_mode=augmentation['fillMode'],
            validation_split=0.2
        )
    else:
        train_datagen = keras.preprocessing.image.ImageDataGenerator(
            rescale=1./255,
            validation_split=0.2
        )

    train_gen = train_datagen.flow_from_directory(
        data_dir,
        target_size=(image_size, image_size),
        batch_size=batch_size,
        class_mode='categorical',
        subset='training',
        shuffle=True
    )

    val_gen = train_datagen.flow_from_directory(
        data_dir,
        target_size=(image_size, image_size),
        batch_size=batch_size,
        class_mode='categorical',
        subset='validation',
        shuffle=False
    )

    return train_gen, val_gen

# Main training
def main():
    num_classes = cfg['numClasses']
    image_size = cfg['imageSize']
    batch_size = cfg['batchSize']
    epochs = cfg['epochs']
    architecture = cfg['architecture']

    # Create model
    model, base = create_model(num_classes, image_size, architecture)

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-3),
        loss='categorical_crossentropy',
        metrics=['accuracy', keras.metrics.TopKCategoricalAccuracy(k=5)]
    )

    print(model.summary())

    # Callbacks
    cb = [
        callbacks.EarlyStopping(patience=10, restore_best_weights=True, monitor='val_accuracy'),
        callbacks.ReduceLROnPlateau(factor=0.5, patience=5, min_lr=1e-6, monitor='val_loss'),
        callbacks.ModelCheckpoint(
            'best_model.keras',
            save_best_only=True,
            monitor='val_accuracy',
            mode='max'
        ),
        callbacks.CSVLogger('training.log'),
    ]

    # Create data generators (expects data_dir/class_name/image.jpg structure)
    train_gen, val_gen = create_generators(
        '${config.dataDir}',
        image_size,
        batch_size,
        cfg.get('augmentation')
    )

    # Phase 1: Train head only
    print("Phase 1: Training classification head...")
    history1 = model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=min(10, epochs // 3),
        callbacks=cb
    )

    # Phase 2: Fine-tune top layers
    print("Phase 2: Fine-tuning...")
    base.trainable = True
    # Freeze early layers
    for layer in base.layers[:-30]:
        layer.trainable = False

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-5),
        loss='categorical_crossentropy',
        metrics=['accuracy', keras.metrics.TopKCategoricalAccuracy(k=5)]
    )

    history2 = model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=epochs,
        initial_epoch=len(history1.history['loss']),
        callbacks=cb
    )

    # Save final model
    model.save('final_model.keras')

    # Convert to TFLite
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]

    if cfg.get('quantization', {}).get('type') == 'int8':
        def representative_dataset():
            for _ in range(100):
                data = next(train_gen)[0]
                yield [data.astype(np.float32)]

        converter.representative_dataset = representative_dataset
        converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
        converter.inference_input_type = tf.uint8
        converter.inference_output_type = tf.uint8

    tflite_model = converter.convert()

    with open('model.tflite', 'wb') as f:
        f.write(tflite_model)

    # Save class labels
    with open('labels.txt', 'w') as f:
        for class_name in sorted(cfg['classMapping'].keys(), key=lambda k: cfg['classMapping'][k]):
            f.write(f"{class_name}\\n")

    print("✅ Training complete!")
    print(f"📁 Model saved: model.tflite")
    print(f"📁 Labels saved: labels.txt")

if __name__ == '__main__':
    main()
`;

  const scriptPath = path.resolve(config.outputDir, 'train.py');
  fs.writeFileSync(scriptPath, script);
  console.log('🐍 Python training script generated:', scriptPath);
}

function generateColabNotebook(config: TrainConfig, trainConfig: any) {
  const notebook = {
    cells: [
      {
        cell_type: 'markdown',
        metadata: {},
        source: [
          `# Edge Model Training for ${config.region}\n`,
          `Architecture: ${config.architecture} | Image Size: ${config.imageSize} | Classes: ${trainConfig.numClasses}\n`,
          `Crops: ${trainConfig.crops.map((c: any) => c.id).join(', ')}`
        ]
      },
      {
        cell_type: 'code',
        metadata: {},
        source: [
          '!pip install -q tensorflow tensorflowjs\n',
          'import tensorflow as tf\n',
          'print("TF Version:", tf.__version__)\n',
          'print("GPU Available:", len(tf.config.list_physical_devices(\'GPU\')) > 0)'
        ],
        outputs: []
      },
      {
        cell_type: 'code',
        metadata: {},
        source: [
          '# Download and prepare dataset\n',
          '# Example: PlantVillage dataset\n',
          '!git clone --depth 1 https://github.com/spMohanty/PlantVillage-Dataset.git data/raw\n',
          '# Organize into data/train/class_name/ structure'
        ],
        outputs: []
      },
      {
        cell_type: 'code',
        metadata: {},
        source: [
          '# Training code (from generated train.py)\n',
          '%run train.py'
        ],
        outputs: []
      },
      {
        cell_type: 'code',
        metadata: {},
        source: [
          '# Convert to TFLite with metadata\n',
          'import tensorflow as tf\n',
          'from tflite_support.metadata_writers import image_classifier\n',
          'from tflite_support.metadata_writers import writer_utils\n',
          '\n',
          'model_path = "model.tflite"\n',
          'labels_path = "labels.txt"\n',
          '\n',
          'writer = image_classifier.MetadataWriter.create_for_inference(\n',
          '    writer_utils.load_file(model_path),\n',
          '    input_norm_mean=[127.5],\n',
          '    input_norm_std=[127.5],\n',
          '    labels=writer_utils.load_file(labels_path).decode().split("\\n")\n',
          ')\n',
          '\n',
          'writer_utils.save_file(writer.populate(), "model_with_metadata.tflite")\n',
          'print("✅ Model with metadata saved")'
        ],
        outputs: []
      },
      {
        cell_type: 'code',
        metadata: {},
        source: [
          '# Test inference\n',
          'interpreter = tf.lite.Interpreter(model_path="model_with_metadata.tflite")\n',
          'interpreter.allocate_tensors()\n',
          'input_details = interpreter.get_input_details()\n',
          'output_details = interpreter.get_output_details()\n',
          'print("Input:", input_details)\n',
          'print("Output:", output_details)'
        ],
        outputs: []
      }
    ],
    metadata: {
      kernelspec: {
        display_name: 'Python 3',
        language: 'python',
        name: 'python3'
      },
      language_info: {
        name: 'python',
        version: '3.10'
      }
    },
    nbformat: 4,
    nbformat_minor: 4
  };

  const notebookPath = path.resolve(config.outputDir, `${config.region}_train.ipynb`);
  fs.writeFileSync(notebookPath, JSON.stringify(notebook, null, 2));
  console.log('📓 Colab notebook generated:', notebookPath);
}

async function main() {
  console.log('🚀 AgriSense Edge Model Training Setup\n');

  const config = parseArgs();

  console.log('Configuration:');
  console.log(`  Region: ${config.region}`);
  console.log(`  Crops: ${config.crops.join(', ')}`);
  console.log(`  Architecture: ${config.architecture}`);
  console.log(`  Epochs: ${config.epochs}`);
  console.log(`  Batch Size: ${config.batchSize}`);
  console.log(`  Image Size: ${config.imageSize}`);
  console.log(`  Quantize: ${config.quantize}`);
  console.log('');

  try {
    const trainConfig = await generateTrainingConfig(config);
    generatePythonTrainingScript(config, trainConfig);
    generateColabNotebook(config, trainConfig);

    console.log('\n✅ Setup complete! Next steps:');
    console.log('1. Download dataset (e.g., PlantVillage) to data/ directory');
    console.log('2. Organize images: data/train/<class_name>/image.jpg');
    console.log('3. Run training:');
    console.log('   - Local: python train.py');
    console.log('   - Colab: Upload and run ${config.region}_train.ipynb');
    console.log('4. Deploy model.tflite to CDN and update region config');

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();