<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { findAuthToken } from '../lib/authToken'
import { StrapiRequestError } from '../lib/strapiClient'
import { streamyApi } from '../lib/streamyApi'

type PlayerKind = 'movie' | 'episode'
type PlayerBackTarget = {
  kind: 'movie' | 'series'
  id: string
}

type PlayerMedia = {
  id: string
  relationId: string | number
  title: string
  year: number | null
  synopsis: string
  videoUrl: string | null
  chapter: string | null
  backTarget: PlayerBackTarget
}

const props = defineProps<{
  kind: PlayerKind
  mediaId: string
}>()

const emit = defineEmits<{
  backToDetail: [target: PlayerBackTarget]
}>()

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:1337').replace(/\/+$/, '')

const loadingMedia = ref(false)
const playerError = ref('')
const activeToken = ref<string | null>(null)
const media = ref<PlayerMedia | null>(null)
const loadedKind = ref<PlayerKind>('movie')
const progressPosition = ref(0)
const progressCompleted = ref(false)
const durationSeconds = ref<number | null>(null)
const progressRecordId = ref<string | null>(null)
const lastSavedAt = ref(0)
const lastSavedPosition = ref(0)
const resumeApplied = ref(false)

const saveInFlight = ref(false)
const queuedForceSave = ref(false)
const autosaveTimer = ref<ReturnType<typeof setInterval> | null>(null)
const autoplayError = ref('')

const videoRef = ref<HTMLVideoElement | null>(null)

const canPlay = computed(() => Boolean(media.value?.videoUrl))
const shouldResume = computed(() => !progressCompleted.value && progressPosition.value > 30)

const progressPercent = computed(() => {
  if (progressCompleted.value) {
    return 100
  }

  if (durationSeconds.value && durationSeconds.value > 0) {
    return Math.min(99, Math.max(0, Math.round((progressPosition.value / durationSeconds.value) * 100)))
  }

  if (progressPosition.value <= 0) {
    return 0
  }

  return Math.min(95, Math.max(1, Math.round(progressPosition.value / 30)))
})

const toClock = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remaining = safeSeconds % 60
  return `${minutes}:${String(remaining).padStart(2, '0')}`
}

const playerStatus = computed(() => {
  if (loadingMedia.value) {
    return 'Loading player data from Strapi...'
  }

  if (!activeToken.value) {
    return 'You are logged out. Sign in to access the player.'
  }

  if (playerError.value) {
    return playerError.value
  }

  if (autoplayError.value) {
    return autoplayError.value
  }

  if (!media.value) {
    return props.kind === 'movie' ? 'Movie not found.' : 'Episode not found.'
  }

  if (!media.value.videoUrl) {
    return props.kind === 'movie' ? 'No MP4 linked for this movie yet.' : 'No MP4 linked for this episode yet.'
  }

  if (progressCompleted.value) {
    return props.kind === 'movie'
      ? 'This movie is marked as completed.'
      : 'This episode is marked as completed.'
  }

  if (shouldResume.value) {
    return `Resume available at ${toClock(progressPosition.value)}.`
  }

  return 'Autosave is active every 8 seconds while playing.'
})

const backButtonLabel = computed(() =>
  props.kind === 'movie' ? 'Back to movie detail' : 'Back to series detail',
)

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

const asString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return String(value)
  }

  return ''
}

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

const getField = (entity: Record<string, unknown>, key: string): unknown => {
  if (key in entity) {
    return entity[key]
  }

  const attributes = asRecord(entity.attributes)
  return attributes?.[key]
}

const unwrapRelation = (value: unknown): unknown => {
  const record = asRecord(value)

  if (!record) {
    return value
  }

  if ('data' in record) {
    return record.data
  }

  return value
}

const getRelationEntities = (entity: Record<string, unknown>, key: string): Record<string, unknown>[] => {
  const relationValue = unwrapRelation(getField(entity, key))

  if (Array.isArray(relationValue)) {
    return relationValue
      .map((entry) => asRecord(entry))
      .filter((entry): entry is Record<string, unknown> => entry !== null)
  }

  const single = asRecord(relationValue)
  return single ? [single] : []
}

const toEntityArray = (response: unknown): Record<string, unknown>[] => {
  const payload = asRecord(response)
  const data = payload?.data

  if (Array.isArray(data)) {
    return data
      .map((entry) => asRecord(entry))
      .filter((entry): entry is Record<string, unknown> => entry !== null)
  }

  const single = asRecord(data)
  return single ? [single] : []
}

const toAbsoluteMediaUrl = (url: string): string => {
  if (!url) {
    return ''
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }

  return url.startsWith('/') ? `${API_ORIGIN}${url}` : `${API_ORIGIN}/${url}`
}

const getEntityId = (entity: Record<string, unknown>): string => {
  const documentId = asString(getField(entity, 'documentId'))
  if (documentId) {
    return documentId
  }

  const id = asString(getField(entity, 'id'))
  if (id) {
    return id
  }

  return ''
}

const getRelationId = (entity: Record<string, unknown>): string | number | null => {
  const numericId = asNumber(getField(entity, 'id'))
  if (numericId !== null) {
    return numericId
  }

  const documentId = asString(getField(entity, 'documentId'))
  if (documentId) {
    return documentId
  }

  return null
}

const toMovieMedia = (entity: Record<string, unknown>): PlayerMedia | null => {
  const title = asString(getField(entity, 'title'))
  if (!title) {
    return null
  }

  const id = getEntityId(entity) || props.mediaId
  const relationId = getRelationId(entity)

  if (!relationId) {
    return null
  }

  const videoEntity = getRelationEntities(entity, 'video')[0]
  const videoUrl = videoEntity ? toAbsoluteMediaUrl(asString(getField(videoEntity, 'url'))) : ''

  return {
    id,
    relationId,
    title,
    year: asNumber(getField(entity, 'year')),
    synopsis: asString(getField(entity, 'synopsis')),
    videoUrl: videoUrl || null,
    chapter: null,
    backTarget: {
      kind: 'movie',
      id,
    },
  }
}

const buildEpisodeChapter = (seasonNumber: number | null, episodeNumber: number | null): string => {
  if (seasonNumber !== null && episodeNumber !== null) {
    return `S${seasonNumber}:E${episodeNumber}`
  }

  if (episodeNumber !== null) {
    return `Episode ${episodeNumber}`
  }

  return 'Episode'
}

const toEpisodeMedia = (entity: Record<string, unknown>): PlayerMedia | null => {
  const relationId = getRelationId(entity)
  if (!relationId) {
    return null
  }

  const episodeId = getEntityId(entity) || props.mediaId
  const episodeTitle = asString(getField(entity, 'title'))
  const episodeNumber = asNumber(getField(entity, 'number'))

  const seasonEntity = getRelationEntities(entity, 'season')[0]
  const seasonNumber = seasonEntity ? asNumber(getField(seasonEntity, 'number')) : null

  const seriesEntity = seasonEntity ? getRelationEntities(seasonEntity, 'series')[0] : null
  const seriesId = seriesEntity ? getEntityId(seriesEntity) : ''
  const seriesTitle = seriesEntity ? asString(getField(seriesEntity, 'title')) : ''

  const chapterPrefix = buildEpisodeChapter(seasonNumber, episodeNumber)
  const chapter = episodeTitle ? `${chapterPrefix} - ${episodeTitle}` : chapterPrefix

  const videoEntity = getRelationEntities(entity, 'video')[0]
  const videoUrl = videoEntity ? toAbsoluteMediaUrl(asString(getField(videoEntity, 'url'))) : ''

  return {
    id: episodeId,
    relationId,
    title: seriesTitle || episodeTitle || chapterPrefix,
    year: seriesEntity ? asNumber(getField(seriesEntity, 'year')) : null,
    synopsis:
      asString(getField(entity, 'synopsis')) ||
      (seriesEntity ? asString(getField(seriesEntity, 'synopsis')) : ''),
    videoUrl: videoUrl || null,
    chapter,
    backTarget: {
      kind: 'series',
      id: seriesId || props.mediaId,
    },
  }
}

const sameIdentifier = (left: string, right: string): boolean => {
  if (!left || !right) {
    return false
  }

  if (left === right) {
    return true
  }

  const leftNumber = Number(left)
  const rightNumber = Number(right)

  return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber === rightNumber
}

const matchesMovieEntityId = (entity: Record<string, unknown>, movieId: string): boolean => {
  const entityId = asString(getField(entity, 'id'))
  const entityDocumentId = asString(getField(entity, 'documentId'))
  return sameIdentifier(entityId, movieId) || sameIdentifier(entityDocumentId, movieId)
}

const matchesEpisodeEntityId = (entity: Record<string, unknown>, episodeId: string): boolean => {
  const entityId = asString(getField(entity, 'id'))
  const entityDocumentId = asString(getField(entity, 'documentId'))
  return sameIdentifier(entityId, episodeId) || sameIdentifier(entityDocumentId, episodeId)
}

const matchesMovieProgress = (progressEntity: Record<string, unknown>): boolean => {
  const movieEntity = getRelationEntities(progressEntity, 'movie')[0]
  if (!movieEntity) {
    return false
  }

  const relationId = asString(getField(movieEntity, 'id'))
  const relationDocumentId = asString(getField(movieEntity, 'documentId'))

  const targetIds = [props.mediaId]
  if (media.value?.id) {
    targetIds.push(media.value.id)
  }

  const relationTarget = media.value ? String(media.value.relationId) : ''
  if (relationTarget) {
    targetIds.push(relationTarget)
  }

  return targetIds.some((targetId) => {
    return sameIdentifier(relationId, targetId) || sameIdentifier(relationDocumentId, targetId)
  })
}

const matchesEpisodeProgress = (progressEntity: Record<string, unknown>): boolean => {
  const episodeEntity = getRelationEntities(progressEntity, 'episode')[0]
  if (!episodeEntity) {
    return false
  }

  const relationId = asString(getField(episodeEntity, 'id'))
  const relationDocumentId = asString(getField(episodeEntity, 'documentId'))

  const targetIds = [props.mediaId]
  if (media.value?.id) {
    targetIds.push(media.value.id)
  }

  const relationTarget = media.value ? String(media.value.relationId) : ''
  if (relationTarget) {
    targetIds.push(relationTarget)
  }

  return targetIds.some((targetId) => {
    return sameIdentifier(relationId, targetId) || sameIdentifier(relationDocumentId, targetId)
  })
}

const extractRecordId = (entity: Record<string, unknown>): string | null => {
  const numericId = asNumber(getField(entity, 'id'))
  if (numericId !== null) {
    return String(numericId)
  }

  const id = asString(getField(entity, 'id'))
  if (id) {
    return id
  }

  const documentId = asString(getField(entity, 'documentId'))
  return documentId || null
}

const stopAutosave = (): void => {
  if (!autosaveTimer.value) {
    return
  }

  clearInterval(autosaveTimer.value)
  autosaveTimer.value = null
}

const saveProgress = async (force: boolean, completedOverride?: boolean): Promise<void> => {
  const token = activeToken.value
  const currentMedia = media.value

  if (!token || !currentMedia) {
    return
  }

  const progressKind = loadedKind.value

  const video = videoRef.value
  const positionSeconds = video ? Math.max(0, Math.floor(video.currentTime)) : progressPosition.value

  let nextDuration = durationSeconds.value
  if (video && Number.isFinite(video.duration) && video.duration > 0) {
    nextDuration = Math.floor(video.duration)
  }

  const completedByRatio = Boolean(nextDuration && nextDuration > 0 && positionSeconds / nextDuration >= 0.95)
  const completed = completedOverride ?? completedByRatio

  if (!force) {
    if (!video || video.paused) {
      return
    }

    if (!completed && positionSeconds < 5 && !progressRecordId.value) {
      return
    }

    const deltaPosition = Math.abs(positionSeconds - lastSavedPosition.value)
    const deltaTime = Date.now() - lastSavedAt.value
    if (!completed && (deltaPosition < 5 || deltaTime < 7500)) {
      return
    }
  }

  if (!completed && positionSeconds <= 0 && !progressRecordId.value) {
    return
  }

  if (saveInFlight.value) {
    if (force) {
      queuedForceSave.value = true
    }
    return
  }

  saveInFlight.value = true

  try {
    const payload = {
      kind: progressKind,
      movie: progressKind === 'movie' ? currentMedia.relationId : null,
      episode: progressKind === 'episode' ? currentMedia.relationId : null,
      positionSeconds,
      durationSeconds: nextDuration ?? undefined,
      completed,
    }

    if (progressRecordId.value) {
      try {
        await streamyApi.updateWatchProgress(progressRecordId.value, payload, { token })
      } catch (error) {
        if (error instanceof StrapiRequestError && error.status === 404) {
          progressRecordId.value = null
        } else {
          throw error
        }
      }
    }

    if (!progressRecordId.value) {
      const createdResponse = await streamyApi.createWatchProgress(payload, { token })
      const createdEntity = toEntityArray(createdResponse)[0]
      const createdId = createdEntity ? extractRecordId(createdEntity) : null
      if (createdId) {
        progressRecordId.value = createdId
      }
    }

    progressPosition.value = positionSeconds
    progressCompleted.value = completed
    durationSeconds.value = nextDuration
    lastSavedPosition.value = positionSeconds
    lastSavedAt.value = Date.now()

    if (playerError.value.startsWith('Progress save failed')) {
      playerError.value = ''
    }
  } catch (error) {
    if (error instanceof StrapiRequestError) {
      playerError.value = `Progress save failed (${error.status}): ${error.message}`
      return
    }

    playerError.value = 'Progress save failed due to an unexpected error.'
  } finally {
    saveInFlight.value = false

    if (queuedForceSave.value) {
      queuedForceSave.value = false
      await saveProgress(true)
    }
  }
}

const startAutosave = (): void => {
  if (typeof window === 'undefined' || autosaveTimer.value) {
    return
  }

  autosaveTimer.value = window.setInterval(() => {
    void saveProgress(false)
  }, 8000)
}

const mediaErrorToMessage = (code: number): string => {
  if (code === 1) {
    return 'Playback aborted by browser.'
  }

  if (code === 2) {
    return 'Network error while loading the video stream.'
  }

  if (code === 3) {
    return 'Video decoding failed. Source may be corrupted or unsupported.'
  }

  if (code === 4) {
    return 'Video format/codec is not supported by this browser.'
  }

  return 'Unknown video playback error.'
}

const tryAutoplay = async (): Promise<void> => {
  const video = videoRef.value
  if (!video || !media.value?.videoUrl) {
    return
  }

  try {
    await video.play()
    autoplayError.value = ''
  } catch {
    autoplayError.value = 'Autoplay was blocked by the browser. Press Play on the video controls.'
  }
}

const onLoadedMetadata = (): void => {
  const video = videoRef.value
  if (!video) {
    return
  }

  if (Number.isFinite(video.duration) && video.duration > 0) {
    durationSeconds.value = Math.floor(video.duration)
  }

  if (resumeApplied.value || !shouldResume.value) {
    return
  }

  const maxSeek = Number.isFinite(video.duration) && video.duration > 1 ? Math.floor(video.duration - 1) : null
  const seekTo = maxSeek !== null ? Math.min(progressPosition.value, maxSeek) : progressPosition.value

  if (seekTo > 0) {
    video.currentTime = seekTo
  }

  resumeApplied.value = true
  void tryAutoplay()
}

const onVideoPlay = (): void => {
  startAutosave()
}

const onVideoPause = (): void => {
  stopAutosave()
  void saveProgress(true)
}

const onVideoEnded = (): void => {
  stopAutosave()
  void saveProgress(true, true)
}

const onVideoError = (): void => {
  const code = videoRef.value?.error?.code ?? 0
  playerError.value = mediaErrorToMessage(code)
}

const restartFromStart = (): void => {
  const video = videoRef.value
  if (!video) {
    return
  }

  video.currentTime = 0
  progressPosition.value = 0
  progressCompleted.value = false
  resumeApplied.value = true
  void saveProgress(true, false)
}

const forceSave = (): void => {
  void saveProgress(true)
}

const backToDetail = (): void => {
  stopAutosave()
  void saveProgress(true)

  const fallbackTarget: PlayerBackTarget =
    props.kind === 'movie'
      ? { kind: 'movie', id: props.mediaId }
      : { kind: 'series', id: props.mediaId }

  emit('backToDetail', media.value?.backTarget ?? fallbackTarget)
}

const loadPlayer = async (): Promise<void> => {
  await saveProgress(true)
  stopAutosave()
  loadingMedia.value = true
  playerError.value = ''
  autoplayError.value = ''
  media.value = null
  progressPosition.value = 0
  progressCompleted.value = false
  durationSeconds.value = null
  progressRecordId.value = null
  resumeApplied.value = false
  lastSavedAt.value = 0
  lastSavedPosition.value = 0
  loadedKind.value = props.kind

  const token = findAuthToken()
  activeToken.value = token

  if (!token) {
    loadingMedia.value = false
    return
  }

  try {
    if (props.kind === 'movie') {
      const [moviesResponse, progressResponse] = await Promise.all([
        streamyApi.getMovies({ token }),
        streamyApi.getWatchProgresses({ token }),
      ])

      const movieEntity = toEntityArray(moviesResponse).find((entity) => matchesMovieEntityId(entity, props.mediaId))
      if (!movieEntity) {
        playerError.value = 'Movie not found.'
        loadingMedia.value = false
        return
      }

      media.value = toMovieMedia(movieEntity)
      if (!media.value) {
        playerError.value = 'Movie payload is invalid.'
        loadingMedia.value = false
        return
      }

      const progressEntities = toEntityArray(progressResponse)
      const movieProgress = progressEntities.find((progressEntity) => {
        const kind = asString(getField(progressEntity, 'kind'))
        return kind === 'movie' && matchesMovieProgress(progressEntity)
      })

      if (movieProgress) {
        progressRecordId.value = extractRecordId(movieProgress)
        progressPosition.value = asNumber(getField(movieProgress, 'positionSeconds')) ?? 0
        progressCompleted.value = Boolean(getField(movieProgress, 'completed'))
        durationSeconds.value = asNumber(getField(movieProgress, 'durationSeconds'))
        lastSavedPosition.value = progressPosition.value
      }
    } else {
      const [episodesResponse, progressResponse] = await Promise.all([
        streamyApi.getEpisodes({ token }),
        streamyApi.getWatchProgresses({ token }),
      ])

      const episodeEntity = toEntityArray(episodesResponse).find((entity) =>
        matchesEpisodeEntityId(entity, props.mediaId),
      )
      if (!episodeEntity) {
        playerError.value = 'Episode not found.'
        loadingMedia.value = false
        return
      }

      media.value = toEpisodeMedia(episodeEntity)
      if (!media.value) {
        playerError.value = 'Episode payload is invalid.'
        loadingMedia.value = false
        return
      }

      const progressEntities = toEntityArray(progressResponse)
      const episodeProgress = progressEntities.find((progressEntity) => {
        const kind = asString(getField(progressEntity, 'kind'))
        return kind === 'episode' && matchesEpisodeProgress(progressEntity)
      })

      if (episodeProgress) {
        progressRecordId.value = extractRecordId(episodeProgress)
        progressPosition.value = asNumber(getField(episodeProgress, 'positionSeconds')) ?? 0
        progressCompleted.value = Boolean(getField(episodeProgress, 'completed'))
        durationSeconds.value = asNumber(getField(episodeProgress, 'durationSeconds'))
        lastSavedPosition.value = progressPosition.value
      }
    }
  } catch (error) {
    media.value = null
    progressPosition.value = 0
    progressCompleted.value = false

    if (error instanceof StrapiRequestError) {
      playerError.value = `API ${error.status}: ${error.message}`
      loadingMedia.value = false
      return
    }

    playerError.value = 'Failed to load player data from Strapi.'
  } finally {
    loadingMedia.value = false
  }
}

const onPageHide = (): void => {
  stopAutosave()
  void saveProgress(true)
}

watch(
  () => [props.kind, props.mediaId],
  () => {
    void loadPlayer()
  },
  { immediate: true },
)

onMounted(() => {
  if (typeof window === 'undefined') {
    return
  }

  window.addEventListener('pagehide', onPageHide)
})

onUnmounted(() => {
  stopAutosave()

  if (typeof window !== 'undefined') {
    window.removeEventListener('pagehide', onPageHide)
  }

  void saveProgress(true)
})
</script>

<template>
  <main class="player-layout">
    <section class="player-main reveal-1">
      <button type="button" class="movie-back-link" @click="backToDetail">{{ backButtonLabel }}</button>

      <p class="eyebrow">Player</p>
      <h1>{{ media?.title ?? (props.kind === 'movie' ? 'Movie player' : 'Episode player') }}</h1>

      <div class="movie-pill-row">
        <span class="movie-pill">{{ media?.year ?? 'N/A' }}</span>
        <span class="movie-pill">{{ props.kind }}</span>
        <span v-if="media?.chapter" class="movie-pill">{{ media.chapter }}</span>
      </div>

      <p class="hero-copy">
        {{
          media?.synopsis ||
          (props.kind === 'movie'
            ? 'Play the linked MP4 file and progress will be synced to Strapi.'
            : 'Play this episode and progress will be synced to Strapi.')
        }}
      </p>

      <p v-if="playerStatus" class="status-copy">{{ playerStatus }}</p>

      <div class="player-video-block">
        <video
          v-if="media?.videoUrl"
          ref="videoRef"
          class="player-video"
          controls
          preload="metadata"
          playsinline
          :src="media.videoUrl"
          @loadedmetadata="onLoadedMetadata"
          @play="onVideoPlay"
          @pause="onVideoPause"
          @ended="onVideoEnded"
          @error="onVideoError"
        ></video>
        <a v-if="media?.videoUrl" class="player-source-link" :href="media.videoUrl" target="_blank" rel="noopener">
          Open raw video URL
        </a>
        <p v-else class="movie-muted-copy">
          {{ props.kind === 'movie' ? 'No video source available for this movie.' : 'No video source available for this episode.' }}
        </p>
      </div>
    </section>

    <section class="player-side-panel reveal-2">
      <div class="panel-head">
        <h2>Watch progress</h2>
        <span>{{ progressPercent }}%</span>
      </div>

      <p class="movie-muted-copy">
        Position: {{ toClock(progressPosition) }} / {{ durationSeconds ? toClock(durationSeconds) : '--:--' }}
      </p>
      <p class="movie-muted-copy">
        {{ progressCompleted ? 'Completed' : shouldResume ? 'Resume point found' : 'No resume point yet' }}
      </p>

      <div class="hero-actions player-actions">
        <button type="button" class="secondary-btn" :disabled="!canPlay" @click="forceSave">Save now</button>
        <button type="button" class="secondary-btn" :disabled="!canPlay" @click="restartFromStart">
          Restart
        </button>
      </div>
    </section>
  </main>
</template>
