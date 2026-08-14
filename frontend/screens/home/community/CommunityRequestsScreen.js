/**
 * CommunityRequestsScreen.js
 *
 * Thin wrapper around the consolidated RequestsScreen component for Community callers.
 */
import React from 'react';
import RequestsScreen from '../../collabs/RequestsScreen';

export default function CommunityRequestsScreen(props) {
  return <RequestsScreen {...props} callerType="community" isBottomTab={true} />;
}
