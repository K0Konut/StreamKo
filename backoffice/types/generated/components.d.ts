import type { Schema, Struct } from '@strapi/strapi';

export interface MediaSubtitleTrack extends Struct.ComponentSchema {
  collectionName: 'components_media_subtitle_tracks';
  info: {
    description: '';
    displayName: 'Subtitle Track';
  };
  attributes: {
    file: Schema.Attribute.Media<'files'> & Schema.Attribute.Required;
    language: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface MediaVideoSource extends Struct.ComponentSchema {
  collectionName: 'components_media_video_sources';
  info: {
    description: '';
    displayName: 'Video Source';
  };
  attributes: {
    file: Schema.Attribute.Media<'videos'> & Schema.Attribute.Required;
    language: Schema.Attribute.String;
    quality: Schema.Attribute.Enumeration<
      ['360p', '480p', '720p', '1080p', '4k']
    >;
    subtitles: Schema.Attribute.Component<'media.subtitle-track', true>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'media.subtitle-track': MediaSubtitleTrack;
      'media.video-source': MediaVideoSource;
    }
  }
}
