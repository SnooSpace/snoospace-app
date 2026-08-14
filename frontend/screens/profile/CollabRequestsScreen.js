/**
 * CollabRequestsScreen.js
 *
 * Thin wrapper around the consolidated RequestsScreen component for Member (Creator) callers.
 */
import React from 'react';
import RequestsScreen from '../collabs/RequestsScreen';

export default function CollabRequestsScreen(props) {
  return <RequestsScreen {...props} callerType="member" isBottomTab={false} />;
}
