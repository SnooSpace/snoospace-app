-- Profile views table (for tracking who viewed profiles)
CREATE TABLE profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewed_member_id BIGINT REFERENCES members(id) ON DELETE CASCADE,
  viewer_member_id BIGINT REFERENCES members(id) ON DELETE CASCADE,
  event_id BIGINT REFERENCES events(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Connection requests table
CREATE TABLE connection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_member_id BIGINT REFERENCES members(id) ON DELETE CASCADE,
  to_member_id BIGINT REFERENCES members(id) ON DELETE CASCADE,
  event_id BIGINT REFERENCES events(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_profile_views_member ON profile_views(viewed_member_id, viewed_at);
CREATE INDEX idx_profile_views_viewer ON profile_views(viewer_member_id);
CREATE INDEX idx_connection_requests_to ON connection_requests(to_member_id, status);
CREATE INDEX idx_connection_requests_from ON connection_requests(from_member_id, status);