<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { findAuthToken } from '../lib/authToken'
import { StrapiRequestError } from '../lib/strapiClient'
import { streamyApi } from '../lib/streamyApi'

type EpisodeDetail = {
  id: string
  relationId: string | number
  title: string
  number: number | null
  chapter: string
  synopsis: string
  videoUrl: string | null
  seasonId: string
  seasonNumber: number | null
  progressPosition: number
  progressCompleted: boolean
  progressUpdatedAt: number
}

type SeasonDetail = {
  id: string
  number: number | null
  episodes: EpisodeDetail[]
}

type SeriesDetail = {
  id: string
  title: string
  year: number | null
  synopsis: string
  genres: string[]
  cast: string[]
  seasons: SeasonDetail[]
}

const props = defineProps<{
  seriesId: string
}>()

const emit = defineEmits<{
  backToCatalog: []
  playEpisode: [episodeId: string]
}>()

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:1337').replace(/\/+$/, '')

const loadingSeries = ref(false)
const detailError = ref('')
const activeToken = ref<string | null>(null)
const series = ref<SeriesDetail | null>(null)

const selectedSeasonId = ref('')
const selectedEpisodeId = ref('')
const resumeEpisodeId = ref('')

const genreList = computed(() => series.value?.genres ?? [])
const castMembers = computed(() => series.value?.cast ?? [])

const allEpisodes = computed(() => {
  if (!series.value) {
    return [] as EpisodeDetail[]
  }

  return series.value.seasons.flatMap((season) => season.episodes)
})

const hasEpisodes = computed(() => allEpisodes.value.length > 0)

const selectedSeason = computed(() => {
  const seasons = series.value?.seasons ?? []
  if (seasons.length === 0) {
    return null
  }

  const foundSeason = seasons.find((season) => season.id === selectedSeasonId.value)
  return foundSeason ?? seasons[0] ?? null
})

const episodeList = computed(() => selectedSeason.value?.episodes ?? [])

const selectedEpisode = computed(() => {
  const episodes = episodeList.value
  if (episodes.length === 0) {
    return null
  }

  const foundEpisode = episodes.find((episode) => episode.id === selectedEpisodeId.value)
  return foundEpisode ?? episodes[0] ?? null
})

const resumeEpisode = computed(() => {
  if (!resumeEpisodeId.value) {
    return null
  }

  return allEpisodes.value.find((episode) => episode.id === resumeEpisodeId.value) ?? null
})

const shouldResume = computed(() => Boolean(resumeEpisode.value))
const canResume = computed(() => Boolean(resumeEpisode.value?.videoUrl))
const canPlaySelected = computed(() => Boolean(selectedEpisode.value?.videoUrl))
const ctaLabel = computed(() => (shouldResume.value ? 'Reprendre' : 'Lire'))

const toClock = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remaining = safeSeconds % 60
  return `${minutes}:${String(remaining).padStart(2, '0')}`
}

const detailStatus = computed(() => {
  if (loadingSeries.value) {
    return 'Loading series details from Strapi...'
  }

  if (!activeToken.value) {
    return 'You are logged out. Sign in to load series details from Strapi.'
  }

  if (detailError.value) {
    return detailError.value
  }

  if (!series.value) {
    return 'Series not found.'
  }

  if (!hasEpisodes.value) {
    return 'No episodes linked to this series yet.'
  }

  if (shouldResume.value && resumeEpisode.value) {
    return `Resume available on ${resumeEpisode.value.chapter} at ${toClock(resumeEpisode.value.progressPosition)}.`
  }

  if (!selectedEpisode.value?.videoUrl) {
    return 'No video linked for the selected episode.'
  }

  return 'Ready to start.'
})

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

const parseTimestamp = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }

  return 0
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

const matchesSeriesEntityId = (entity: Record<string, unknown>, seriesId: string): boolean => {
  const entityId = asString(getField(entity, 'id'))
  const entityDocumentId = asString(getField(entity, 'documentId'))
  return sameIdentifier(entityId, seriesId) || sameIdentifier(entityDocumentId, seriesId)
}

const buildEpisodeIdentifiers = (entity: Record<string, unknown>): string[] => {
  const identifiers = new Set<string>()

  const id = asString(getField(entity, 'id'))
  if (id) {
    identifiers.add(id)
  }

  const documentId = asString(getField(entity, 'documentId'))
  if (documentId) {
    identifiers.add(documentId)
  }

  return [...identifiers]
}

const isProgressForEpisode = (progressEntity: Record<string, unknown>, identifiers: string[]): boolean => {
  const kind = asString(getField(progressEntity, 'kind'))
  if (kind !== 'episode') {
    return false
  }

  const episodeEntity = getRelationEntities(progressEntity, 'episode')[0]
  if (!episodeEntity) {
    return false
  }

  const relationId = asString(getField(episodeEntity, 'id'))
  const relationDocumentId = asString(getField(episodeEntity, 'documentId'))

  return identifiers.some((identifier) => {
    return sameIdentifier(relationId, identifier) || sameIdentifier(relationDocumentId, identifier)
  })
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

const pickFirstPlayableEpisode = (seasons: SeasonDetail[]): EpisodeDetail | null => {
  for (const season of seasons) {
    const playable = season.episodes.find((episode) => Boolean(episode.videoUrl))
    if (playable) {
      return playable
    }
  }

  for (const season of seasons) {
    if (season.episodes[0]) {
      return season.episodes[0]
    }
  }

  return null
}

const selectSeason = (seasonId: string): void => {
  selectedSeasonId.value = seasonId

  const season = series.value?.seasons.find((entry) => entry.id === seasonId)
  if (!season) {
    return
  }

  const selected = season.episodes.find((episode) => episode.id === selectedEpisodeId.value)
  if (selected) {
    return
  }

  const playable = season.episodes.find((episode) => Boolean(episode.videoUrl))
  selectedEpisodeId.value = playable?.id ?? season.episodes[0]?.id ?? ''
}

const openEpisode = (episode: EpisodeDetail | null): void => {
  if (!episode || !episode.videoUrl) {
    return
  }

  emit('playEpisode', episode.id)
}

const openPrimary = (): void => {
  if (shouldResume.value && resumeEpisode.value?.videoUrl) {
    openEpisode(resumeEpisode.value)
    return
  }

  openEpisode(selectedEpisode.value)
}

const loadSeriesDetail = async (): Promise<void> => {
  loadingSeries.value = true
  detailError.value = ''
  series.value = null
  selectedSeasonId.value = ''
  selectedEpisodeId.value = ''
  resumeEpisodeId.value = ''

  const token = findAuthToken()
  activeToken.value = token

  if (!token) {
    loadingSeries.value = false
    return
  }

  try {
    const [seriesResponse, progressResponse] = await Promise.all([
      streamyApi.getSeries({ token }),
      streamyApi.getWatchProgresses({ token }),
    ])

    const seriesEntity = toEntityArray(seriesResponse).find((entity) =>
      matchesSeriesEntityId(entity, props.seriesId),
    )

    if (!seriesEntity) {
      detailError.value = 'Series not found.'
      loadingSeries.value = false
      return
    }

    const title = asString(getField(seriesEntity, 'title'))
    const seriesEntityId = getEntityId(seriesEntity)
    if (!title || !seriesEntityId) {
      detailError.value = 'Series payload is invalid.'
      loadingSeries.value = false
      return
    }

    const genres = getRelationEntities(seriesEntity, 'genres')
      .map((genreEntity) => asString(getField(genreEntity, 'name')))
      .filter((genreName) => genreName.length > 0)

    const cast = getRelationEntities(seriesEntity, 'cast')
      .map((personEntity) => asString(getField(personEntity, 'name')))
      .filter((personName) => personName.length > 0)

    const progressEntities = toEntityArray(progressResponse)
    const rawSeasons = getRelationEntities(seriesEntity, 'seasons')

    const seasons: SeasonDetail[] = rawSeasons
      .map((seasonEntity) => {
        const seasonId = getEntityId(seasonEntity)
        if (!seasonId) {
          return null
        }

        const seasonNumber = asNumber(getField(seasonEntity, 'number'))
        const rawEpisodes = getRelationEntities(seasonEntity, 'episodes')

        const episodes: EpisodeDetail[] = rawEpisodes
          .map((episodeEntity) => {
            const episodeId = getEntityId(episodeEntity)
            const relationId = getRelationId(episodeEntity)
            if (!episodeId || !relationId) {
              return null
            }

            const episodeNumber = asNumber(getField(episodeEntity, 'number'))
            const episodeTitle = asString(getField(episodeEntity, 'title'))
            const videoEntity = getRelationEntities(episodeEntity, 'video')[0]
            const videoUrl = videoEntity
              ? toAbsoluteMediaUrl(asString(getField(videoEntity, 'url'))) || null
              : null

            const episodeIdentifiers = buildEpisodeIdentifiers(episodeEntity)
            const matchingProgress = progressEntities
              .filter((progressEntity) => isProgressForEpisode(progressEntity, episodeIdentifiers))
              .sort((left, right) => {
                const leftTimestamp =
                  parseTimestamp(getField(left, 'updatedAt')) || parseTimestamp(getField(left, 'createdAt'))
                const rightTimestamp =
                  parseTimestamp(getField(right, 'updatedAt')) || parseTimestamp(getField(right, 'createdAt'))
                return rightTimestamp - leftTimestamp
              })[0]

            const progressPosition = matchingProgress
              ? (asNumber(getField(matchingProgress, 'positionSeconds')) ?? 0)
              : 0
            const progressCompleted = matchingProgress ? Boolean(getField(matchingProgress, 'completed')) : false
            const progressUpdatedAt = matchingProgress
              ? parseTimestamp(getField(matchingProgress, 'updatedAt')) ||
                parseTimestamp(getField(matchingProgress, 'createdAt'))
              : 0

            const chapterPrefix = buildEpisodeChapter(seasonNumber, episodeNumber)
            const chapter = episodeTitle ? `${chapterPrefix} - ${episodeTitle}` : chapterPrefix

            return {
              id: episodeId,
              relationId,
              title: episodeTitle || chapterPrefix,
              number: episodeNumber,
              chapter,
              synopsis: asString(getField(episodeEntity, 'synopsis')),
              videoUrl,
              seasonId,
              seasonNumber,
              progressPosition,
              progressCompleted,
              progressUpdatedAt,
            } satisfies EpisodeDetail
          })
          .filter((episode): episode is EpisodeDetail => episode !== null)
          .sort((left, right) => {
            const leftOrder = left.number ?? Number.MAX_SAFE_INTEGER
            const rightOrder = right.number ?? Number.MAX_SAFE_INTEGER
            return leftOrder - rightOrder
          })

        return {
          id: seasonId,
          number: seasonNumber,
          episodes,
        } satisfies SeasonDetail
      })
      .filter((season): season is SeasonDetail => season !== null)
      .sort((left, right) => {
        const leftOrder = left.number ?? Number.MAX_SAFE_INTEGER
        const rightOrder = right.number ?? Number.MAX_SAFE_INTEGER
        return leftOrder - rightOrder
      })

    series.value = {
      id: seriesEntityId,
      title,
      year: asNumber(getField(seriesEntity, 'year')),
      synopsis: asString(getField(seriesEntity, 'synopsis')),
      genres,
      cast,
      seasons,
    }

    const resumableEpisodes = seasons
      .flatMap((season) => season.episodes)
      .filter((episode) => !episode.progressCompleted && episode.progressPosition > 30)
      .sort((left, right) => right.progressUpdatedAt - left.progressUpdatedAt)

    const resume = resumableEpisodes[0] ?? null
    const defaultEpisode = resume ?? pickFirstPlayableEpisode(seasons)

    if (defaultEpisode) {
      selectedSeasonId.value = defaultEpisode.seasonId
      selectedEpisodeId.value = defaultEpisode.id
    }

    if (resume) {
      resumeEpisodeId.value = resume.id
    }
  } catch (error) {
    series.value = null
    selectedSeasonId.value = ''
    selectedEpisodeId.value = ''
    resumeEpisodeId.value = ''

    if (error instanceof StrapiRequestError) {
      detailError.value = `API ${error.status}: ${error.message}`
      loadingSeries.value = false
      return
    }

    detailError.value = 'Failed to load series details from Strapi.'
  } finally {
    loadingSeries.value = false
  }
}

watch(
  () => props.seriesId,
  () => {
    void loadSeriesDetail()
  },
  { immediate: true },
)
</script>

<template>
  <main class="movie-layout">
    <section class="movie-hero reveal-1">
      <button type="button" class="movie-back-link" @click="emit('backToCatalog')">
        Back to catalogue
      </button>

      <p class="eyebrow">Series detail</p>
      <h1>{{ series?.title ?? 'Series detail' }}</h1>

      <div class="movie-pill-row">
        <span class="movie-pill">{{ series?.year ?? 'N/A' }}</span>
        <span v-for="genre in genreList" :key="genre" class="movie-pill">{{ genre }}</span>
      </div>

      <p class="hero-copy">
        {{ series?.synopsis || 'No synopsis available for this series yet.' }}
      </p>

      <p v-if="detailStatus" class="status-copy">{{ detailStatus }}</p>

      <div class="hero-actions">
        <button type="button" class="primary-btn" :disabled="!(shouldResume ? canResume : canPlaySelected)" @click="openPrimary">
          {{ ctaLabel }}
        </button>
        <button type="button" class="secondary-btn" @click="emit('backToCatalog')">
          Return to catalogue
        </button>
      </div>

      <div v-if="series && hasEpisodes" class="series-picker-block">
        <p class="series-picker-title">Saisons</p>
        <div class="series-season-row">
          <button
            v-for="season in series.seasons"
            :key="season.id"
            type="button"
            class="series-season-chip"
            :class="{ active: selectedSeason?.id === season.id }"
            @click="selectSeason(season.id)"
          >
            {{ season.number ? `S${season.number}` : 'Season' }}
          </button>
        </div>

        <div class="series-episode-list">
          <article
            v-for="episode in episodeList"
            :key="episode.id"
            class="series-episode-card"
            :class="{ active: selectedEpisode?.id === episode.id }"
            @click="selectedEpisodeId = episode.id"
          >
            <div>
              <p class="series-episode-title">{{ episode.chapter }}</p>
              <p class="movie-muted-copy">
                {{
                  episode.progressCompleted
                    ? 'Completed'
                    : episode.progressPosition > 30
                      ? `Resume at ${toClock(episode.progressPosition)}`
                      : 'Not started'
                }}
              </p>
            </div>
            <button
              type="button"
              class="secondary-btn series-episode-btn"
              :disabled="!episode.videoUrl"
              @click.stop="openEpisode(episode)"
            >
              {{ episode.progressPosition > 30 && !episode.progressCompleted ? 'Reprendre' : 'Lire' }}
            </button>
          </article>
          <p v-if="episodeList.length === 0" class="movie-muted-copy">
            No episodes in this season yet.
          </p>
        </div>
      </div>
    </section>

    <section class="movie-side-panel reveal-2">
      <div class="panel-head">
        <h2>Cast</h2>
        <span>{{ castMembers.length }} member{{ castMembers.length > 1 ? 's' : '' }}</span>
      </div>

      <div class="movie-cast-list">
        <span v-for="person in castMembers" :key="person" class="movie-cast-chip">{{ person }}</span>
        <p v-if="castMembers.length === 0" class="movie-muted-copy">No cast assigned yet.</p>
      </div>

      <div class="movie-video-block">
        <p class="movie-video-title">Selected episode</p>
        <p class="movie-muted-copy">
          {{
            selectedEpisode
              ? selectedEpisode.videoUrl
                ? `${selectedEpisode.chapter} is ready for playback.`
                : `${selectedEpisode.chapter} has no MP4 linked.`
              : 'Select an episode to start.'
          }}
        </p>
      </div>
    </section>
  </main>
</template>
