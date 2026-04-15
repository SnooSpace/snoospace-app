import React from 'react';
import { Text } from 'react-native';

const mentionRegex = /(@[a-zA-Z0-9._-]+)/g;

const buildEntityMap = (entities) => {
  const map = {};
  let list = entities;

  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch (error) {
      console.warn('[MentionTextRenderer] Failed to parse tagged entities string:', error);
      list = [];
    }
  }

  if (!Array.isArray(list)) {
    return map;
  }

  list.forEach((entity) => {
    const username = (entity?.username || entity?.name || '')
      .trim()
      .toLowerCase();
    if (username) {
      map[username] = entity;
    }
  });
  return map;
};

const MentionTextRenderer = ({
  prefix = null,
  text = '',
  taggedEntities = [],
  textStyle,
  mentionStyle,
  onMentionPress,
}) => {
  if (!text && !prefix) return null;

  const segments = text ? text.split(mentionRegex) : [];
  const entityMap = buildEntityMap(taggedEntities);

  const renderSegment = (segment, index) => {
    if (!segment) {
      return (
        <Text key={`empty-${index}`}>
          {segment}
        </Text>
      );
    }

    if (/^@[a-zA-Z0-9._-]+$/.test(segment)) {
      const usernameKey = segment.slice(1).toLowerCase();
      const entity = entityMap[usernameKey];
      if (entity && typeof onMentionPress === 'function') {
        return (
          <Text
            key={`mention-${segment}-${index}`}
            style={mentionStyle}
            onPress={() => onMentionPress(entity)}
          >
            {segment}
          </Text>
        );
      }
    }

    return (
      <Text key={`text-${index}`}>
        {segment}
      </Text>
    );
  };

  return (
    <Text style={textStyle}>
      {prefix}
      {prefix && text ? ' ' : null}
      {segments.map(renderSegment)}
    </Text>
  );
};

export default MentionTextRenderer;

