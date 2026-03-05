import { spawn } from 'node:child_process';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Core } from '@strapi/strapi';

type UploadFileRecord = {
  id: number;
  hash?: string | null;
  ext?: string | null;
  mime?: string | null;
  url?: string | null;
  name?: string | null;
};

type VideoRenditionPreset = {
  label: string;
  width: number;
  height: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  bandwidth: number;
};

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.m4v',
  '.mkv',
  '.webm',
  '.avi',
]);

const HLS_RENDITIONS: VideoRenditionPreset[] = [
  {
    label: '1080p',
    width: 1920,
    height: 1080,
    videoBitrateKbps: 5000,
    audioBitrateKbps: 192,
    bandwidth: 5600000,
  },
  {
    label: '720p',
    width: 1280,
    height: 720,
    videoBitrateKbps: 2800,
    audioBitrateKbps: 128,
    bandwidth: 3200000,
  },
  {
    label: '480p',
    width: 854,
    height: 480,
    videoBitrateKbps: 1400,
    audioBitrateKbps: 96,
    bandwidth: 1600000,
  },
  {
    label: '360p',
    width: 640,
    height: 360,
    videoBitrateKbps: 900,
    audioBitrateKbps: 96,
    bandwidth: 1100000,
  },
];

const HLS_ROOT_DIR = ['uploads', 'hls'];
const MASTER_PLAYLIST_FILE = 'master.m3u8';
const SEGMENT_DURATION_SECONDS = 6;
const QUEUE_SCAN_BATCH_SIZE = 200;
const HLS_COMPAT_MARKER = '#STREAMKO-HLS-V2';

type CommandResult = {
  stdout: string;
  stderr: string;
};

const toSafeHash = (value: string, fallback: string): string => {
  const sanitized = value.replace(/[^a-zA-Z0-9_-]/g, '_');
  return sanitized.length > 0 ? sanitized : fallback;
};

const normalizeExt = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return '';
  }

  return normalized.startsWith('.') ? normalized : `.${normalized}`;
};

const detectFileExtension = (file: UploadFileRecord): string => {
  const extFromField = normalizeExt(file.ext || '');
  if (extFromField) {
    return extFromField;
  }

  const urlPath = (file.url || '').split('?').shift() || '';
  const extFromUrl = normalizeExt(path.extname(urlPath));
  if (extFromUrl) {
    return extFromUrl;
  }

  return normalizeExt(path.extname(file.name || ''));
};

const isPlayableVideoFile = (file: UploadFileRecord): boolean => {
  const url = (file.url || '').trim();
  const ext = detectFileExtension(file);
  const mime = (file.mime || '').trim().toLowerCase();

  if (!url.startsWith('/uploads/')) {
    return false;
  }

  if (url.includes('/uploads/hls/')) {
    return false;
  }

  if (ext === '.m3u8') {
    return false;
  }

  if (mime.startsWith('video/')) {
    return true;
  }

  return VIDEO_EXTENSIONS.has(ext);
};

const runCommand = async (command: string, args: string[]): Promise<CommandResult> => {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(`${command} exited with code ${code}. ${stderr || stdout}`.trim()));
    });
  });
};

const commandExists = async (command: string): Promise<boolean> => {
  try {
    await runCommand(command, ['-version']);
    return true;
  } catch {
    return false;
  }
};

const parseResolution = (value: string): { width: number; height: number } | null => {
  const match = value.trim().match(/^(\d+)x(\d+)$/);
  if (!match) {
    return null;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
};

const buildRenditions = (sourceHeight: number | null): VideoRenditionPreset[] => {
  if (!sourceHeight || !Number.isFinite(sourceHeight) || sourceHeight <= 0) {
    return [HLS_RENDITIONS[1], HLS_RENDITIONS[2], HLS_RENDITIONS[3]];
  }

  const filtered = HLS_RENDITIONS.filter((preset) => preset.height <= sourceHeight + 16);
  if (filtered.length > 0) {
    return filtered;
  }

  return [HLS_RENDITIONS[HLS_RENDITIONS.length - 1]];
};

const getVideoResolution = async (
  inputPath: string,
): Promise<{ width: number; height: number } | null> => {
  try {
    const probeResult = await runCommand('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=s=x:p=0',
      inputPath,
    ]);

    return parseResolution(probeResult.stdout);
  } catch {
    return null;
  }
};

const createVariantPlaylist = async (
  inputPath: string,
  outputDir: string,
  rendition: VideoRenditionPreset,
): Promise<void> => {
  const playlistFile = `${rendition.label}.m3u8`;
  const segmentPattern = `${rendition.label}_%03d.ts`;

  const args = [
    '-y',
    '-i',
    inputPath,
    '-map',
    '0:v:0',
    '-map',
    '0:a?',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-profile:v',
    'main',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '20',
    '-g',
    '48',
    '-keyint_min',
    '48',
    '-sc_threshold',
    '0',
    '-vf',
    `scale=w=-2:h=${rendition.height}:force_original_aspect_ratio=decrease`,
    '-b:v',
    `${rendition.videoBitrateKbps}k`,
    '-maxrate',
    `${Math.round(rendition.videoBitrateKbps * 1.08)}k`,
    '-bufsize',
    `${Math.round(rendition.videoBitrateKbps * 1.6)}k`,
    '-c:a',
    'aac',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-b:a',
    `${rendition.audioBitrateKbps}k`,
    '-hls_time',
    String(SEGMENT_DURATION_SECONDS),
    '-hls_playlist_type',
    'vod',
    '-hls_flags',
    'independent_segments',
    '-hls_segment_filename',
    path.join(outputDir, segmentPattern),
    path.join(outputDir, playlistFile),
  ];

  await runCommand('ffmpeg', args);
};

const writeMasterPlaylist = async (
  outputDir: string,
  renditions: VideoRenditionPreset[],
): Promise<void> => {
  const lines: string[] = ['#EXTM3U', '#EXT-X-VERSION:3', HLS_COMPAT_MARKER];

  for (const rendition of renditions) {
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${rendition.bandwidth}`);
    lines.push(`${rendition.label}.m3u8`);
  }

  lines.push('');
  await writeFile(path.join(outputDir, MASTER_PLAYLIST_FILE), lines.join('\n'), 'utf-8');
};

export const createHlsTranscodeManager = (
  strapi: Core.Strapi,
): {
  init: () => Promise<void>;
  destroy: () => void;
} => {
  let enabled = false;
  let running = false;
  const queue: number[] = [];
  const queuedIds = new Set<number>();
  const processingIds = new Set<number>();

  const enqueue = (fileId: number): void => {
    if (!Number.isFinite(fileId) || fileId <= 0) {
      return;
    }

    if (queuedIds.has(fileId) || processingIds.has(fileId)) {
      return;
    }

    queuedIds.add(fileId);
    queue.push(fileId);
    void runQueue();
  };

  const dequeue = (): number | null => {
    const next = queue.shift();
    if (!next) {
      return null;
    }

    queuedIds.delete(next);
    return next;
  };

  const getUploadFileById = async (fileId: number): Promise<UploadFileRecord | null> => {
    const record = await strapi.db.query('plugin::upload.file').findOne({
      where: { id: fileId },
      select: ['id', 'name', 'hash', 'ext', 'mime', 'url'],
    });

    return (record as UploadFileRecord | null) || null;
  };

  const toAbsolutePublicPath = (publicDir: string, mediaUrl: string): string | null => {
    if (!mediaUrl.startsWith('/uploads/')) {
      return null;
    }

    return path.join(publicDir, mediaUrl.replace(/^\/+/, ''));
  };

  const processUploadFile = async (fileId: number): Promise<void> => {
    const file = await getUploadFileById(fileId);
    if (!file || !isPlayableVideoFile(file)) {
      return;
    }

    const publicDir = strapi.dirs.static.public;
    const sourcePath = toAbsolutePublicPath(publicDir, file.url || '');
    if (!sourcePath) {
      return;
    }

    try {
      await access(sourcePath);
    } catch {
      strapi.log.warn(`[hls] Source file missing for upload ${file.id}: ${sourcePath}`);
      return;
    }

    const hashSource = file.hash || `file-${file.id}`;
    const safeHash = toSafeHash(hashSource, `file-${file.id}`);
    const hlsRoot = path.join(publicDir, ...HLS_ROOT_DIR);
    const outputDir = path.join(hlsRoot, safeHash);
    const masterPlaylistPath = path.join(outputDir, MASTER_PLAYLIST_FILE);

    try {
      await access(masterPlaylistPath);
      const existingMaster = await readFile(masterPlaylistPath, 'utf-8');
      if (existingMaster.includes(HLS_COMPAT_MARKER)) {
        return;
      }

      strapi.log.info(`[hls] Regenerating legacy playlist for upload ${file.id}.`);
    } catch {
      // Playlist does not exist yet, continue.
    }

    await mkdir(hlsRoot, { recursive: true });
    await rm(outputDir, { recursive: true, force: true });
    await mkdir(outputDir, { recursive: true });

    const resolution = await getVideoResolution(sourcePath);
    const renditions = buildRenditions(resolution?.height ?? null);
    if (renditions.length === 0) {
      strapi.log.warn(`[hls] No renditions selected for upload ${file.id}.`);
      return;
    }

    strapi.log.info(
      `[hls] Transcoding upload ${file.id} (${file.name || file.url}) to ${renditions.length} HLS rendition(s).`,
    );

    for (const rendition of renditions) {
      await createVariantPlaylist(sourcePath, outputDir, rendition);
    }

    await writeMasterPlaylist(outputDir, renditions);
    strapi.log.info(`[hls] Ready: /uploads/hls/${safeHash}/${MASTER_PLAYLIST_FILE}`);
  };

  const runQueue = async (): Promise<void> => {
    if (!enabled || running) {
      return;
    }

    running = true;

    try {
      for (;;) {
        const fileId = dequeue();
        if (!fileId) {
          break;
        }

        processingIds.add(fileId);
        try {
          await processUploadFile(fileId);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          strapi.log.error(`[hls] Transcode failed for upload ${fileId}: ${message}`);
        } finally {
          processingIds.delete(fileId);
        }
      }
    } finally {
      running = false;
    }
  };

  const enqueueBootstrapFiles = async (): Promise<void> => {
    let offset = 0;

    for (;;) {
      const files = (await strapi.db.query('plugin::upload.file').findMany({
        select: ['id', 'hash', 'ext', 'mime', 'url', 'name'],
        offset,
        limit: QUEUE_SCAN_BATCH_SIZE,
        orderBy: { id: 'asc' },
      })) as UploadFileRecord[];

      if (!files || files.length === 0) {
        break;
      }

      for (const file of files) {
        if (isPlayableVideoFile(file)) {
          enqueue(file.id);
        }
      }

      offset += files.length;
    }
  };

  const subscribeUploadLifecycle = (): void => {
    strapi.db.lifecycles.subscribe({
      models: ['plugin::upload.file'],
      async afterCreate(event) {
        const id = Number((event.result as { id?: unknown } | null)?.id);
        if (Number.isFinite(id) && id > 0) {
          enqueue(id);
        }
      },
      async afterUpdate(event) {
        const id = Number((event.result as { id?: unknown } | null)?.id);
        if (Number.isFinite(id) && id > 0) {
          enqueue(id);
        }
      },
    });
  };

  const init = async (): Promise<void> => {
    const featureFlag = process.env.HLS_TRANSCODE_ENABLED;
    if (featureFlag && featureFlag.toLowerCase() === 'false') {
      strapi.log.info('[hls] HLS transcode manager disabled by HLS_TRANSCODE_ENABLED=false.');
      return;
    }

    const [hasFfmpeg, hasFfprobe] = await Promise.all([
      commandExists('ffmpeg'),
      commandExists('ffprobe'),
    ]);

    if (!hasFfmpeg || !hasFfprobe) {
      strapi.log.warn(
        '[hls] ffmpeg/ffprobe not found. Automatic HLS conversion is disabled. Install ffmpeg on the API host.',
      );
      return;
    }

    enabled = true;
    subscribeUploadLifecycle();
    await enqueueBootstrapFiles();
    void runQueue();
    strapi.log.info('[hls] Automatic HLS conversion is enabled.');
  };

  const destroy = (): void => {
    enabled = false;
    queue.length = 0;
    queuedIds.clear();
    processingIds.clear();
  };

  return { init, destroy };
};
