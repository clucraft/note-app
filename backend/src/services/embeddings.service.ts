// Model to use for embeddings
const MODEL_NAME = 'Xenova/bge-small-en-v1.5';

// Singleton pipeline instance (using any type since we dynamically import)
let embeddingPipeline: any = null;
let isLoading = false;
let loadingPromise: Promise<any> | null = null;
let embeddingsDisabled = false;

/**
 * Check if embeddings are available
 */
export function isEmbeddingsAvailable(): boolean {
  return !embeddingsDisabled;
}

/**
 * Get or initialize the embedding pipeline
 * Uses lazy loading - model is only downloaded on first use
 * Dynamic import to avoid ESM/CommonJS issues
 */
async function getEmbeddingPipeline(): Promise<any> {
  if (embeddingsDisabled) {
    throw new Error('Embeddings are disabled');
  }

  if (embeddingPipeline) {
    return embeddingPipeline;
  }

  if (isLoading && loadingPromise) {
    return loadingPromise;
  }

  isLoading = true;
  console.log(`Loading embedding model: ${MODEL_NAME}...`);

  try {
    // Dynamic import to handle ESM module
    const { pipeline } = await import('@xenova/transformers');

    loadingPromise = pipeline('feature-extraction', MODEL_NAME, {
      // Use quantized model for faster inference and smaller size
      quantized: true,
    });

    embeddingPipeline = await loadingPromise;
    console.log('Embedding model loaded successfully');
    return embeddingPipeline;
  } catch (error: any) {
    isLoading = false;
    loadingPromise = null;

    // Check if this is a native module loading error (Docker/Alpine issue)
    if (error.code === 'ERR_DLOPEN_FAILED' || error.message?.includes('ld-linux') || error.message?.includes('GLIBC')) {
      console.warn('Embeddings disabled: Native ONNX runtime not available in this environment');
      console.warn('Semantic search will not work. Keyword search still available.');
      embeddingsDisabled = true;
    }
    throw error;
  }
}

/**
 * Generate embedding vector for text
 * @param text - Text to embed
 * @returns Float32Array of embedding values (384 dimensions for bge-small)
 */
export async function generateEmbedding(text: string): Promise<Float32Array> {
  const pipe = await getEmbeddingPipeline();

  // Truncate text if too long (model has ~512 token limit)
  const truncatedText = text.slice(0, 8000);

  const output = await pipe(truncatedText, {
    pooling: 'mean',
    normalize: true,
  });

  // Convert to Float32Array - output.data is a typed array
  const data = output.data as unknown as ArrayLike<number>;
  return new Float32Array(Array.from(data));
}

/**
 * Compute cosine similarity between two embedding vectors
 * @param a - First embedding vector
 * @param b - Second embedding vector
 * @returns Similarity score between -1 and 1 (1 = identical)
 */
export function cosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Convert embedding to Buffer for SQLite storage
 */
export function embeddingToBuffer(embedding: Float32Array): Buffer {
  return Buffer.from(embedding.buffer);
}

/**
 * Convert Buffer from SQLite back to Float32Array
 */
export function bufferToEmbedding(buffer: Buffer): Float32Array {
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
}

/**
 * Strip HTML tags and get plain text for embedding
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Prepare note text for embedding
 * Combines title and content into a single string
 */
export function prepareNoteText(title: string, content: string): string {
  const plainContent = stripHtml(content);
  return `${title}\n\n${plainContent}`;
}

/**
 * Check if model is loaded
 */
export function isModelLoaded(): boolean {
  return embeddingPipeline !== null;
}

/**
 * Preload the model (call on server start for faster first search)
 */
export async function preloadModel(): Promise<void> {
  try {
    await getEmbeddingPipeline();
  } catch (error) {
    console.error('Failed to preload embedding model:', error);
  }
}
