-- =============================================
-- StudyMate Database Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. PROFILES TABLE (extends auth.users)
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  username TEXT UNIQUE,
  full_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  university TEXT,
  subjects TEXT[] DEFAULT '{}',
  study_style TEXT,
  goals TEXT,
  looking_for TEXT,
  availability TEXT,
  last_seen TIMESTAMPTZ,
  is_admin BOOLEAN DEFAULT FALSE,
  is_banned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- 2. POSTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  subject TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);

-- =============================================
-- 3. POST LIKES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS post_likes (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- =============================================
-- 4. COMMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);

-- =============================================
-- 5. MATE REQUESTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS mate_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  to_user UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  note TEXT,
  subject TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mate_requests_to ON mate_requests(to_user);
CREATE INDEX IF NOT EXISTS idx_mate_requests_from ON mate_requests(from_user);

-- =============================================
-- 6. CONNECTIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  user2_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user1_id, user2_id)
);

CREATE INDEX IF NOT EXISTS idx_connections_user1 ON connections(user1_id);
CREATE INDEX IF NOT EXISTS idx_connections_user2 ON connections(user2_id);

-- =============================================
-- 7. ROOMS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  category TEXT,
  room_type TEXT DEFAULT 'public' CHECK (room_type IN ('public', 'private')),
  max_members INT DEFAULT 50,
  member_count INT DEFAULT 0,
  active_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  icon TEXT,
  color TEXT,
  pinned_message_id UUID,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_subject ON rooms(subject);
CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms(room_type);
CREATE INDEX IF NOT EXISTS idx_rooms_category ON rooms(category);

-- =============================================
-- SEED: 4 Default Focus Rooms
-- =============================================
INSERT INTO rooms (id, name, description, category, icon, color, room_type, max_members, is_active) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Deep Focus', 'Silent study zone. No distractions, pure concentration. Use the Pomodoro technique together.', 'Focus', '🎯', '#7C3AED', 'public', 100, true),
  ('22222222-2222-2222-2222-222222222222', 'Chill Study Lounge', 'Casual study vibes. Lo-fi beats, light chat, and productive sessions.', 'Casual', '☕', '#F59E0B', 'public', 100, true),
  ('33333333-3333-3333-3333-333333333333', 'Exam Prep HQ', 'Cramming for exams? Join fellow students preparing for tests and finals.', 'Exam Prep', '📚', '#EF4444', 'public', 100, true),
  ('44444444-4444-4444-4444-444444444444', 'Late Night Grind', 'For the night owls. Burn the midnight oil with fellow late-night studiers.', 'Night Owl', '🌙', '#6366F1', 'public', 100, true)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 8. ROOM MEMBERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS room_members (
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- =============================================
-- 9. ROOM MESSAGES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS room_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_messages_room ON room_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_room_messages_created ON room_messages(created_at DESC);

-- =============================================
-- 9b. ROOM PINS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS room_pins (
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  pinned_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id, pinned_user_id)
);

-- =============================================
-- 9c. ROOM ACTIVE COUNT RPCs
-- =============================================
CREATE OR REPLACE FUNCTION increment_room_active(room_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE rooms SET active_count = active_count + 1 WHERE id = room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_room_active(room_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE rooms SET active_count = GREATEST(0, active_count - 1) WHERE id = room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 10. DIRECT MESSAGES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  to_user UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dm_from ON direct_messages(from_user);
CREATE INDEX IF NOT EXISTS idx_dm_to ON direct_messages(to_user);
CREATE INDEX IF NOT EXISTS idx_dm_created ON direct_messages(created_at DESC);

-- =============================================
-- 11. SESSIONS TABLE (Live Study Sessions)
-- =============================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  subject TEXT,
  description TEXT,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'ended')),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  chat_control TEXT DEFAULT 'everyone' CHECK (chat_control IN ('everyone', 'followers', 'disabled')),
  allow_guests BOOLEAN DEFAULT TRUE,
  viewer_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_host ON sessions(host_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_scheduled ON sessions(scheduled_at);

-- =============================================
-- 12. SESSION MESSAGES TABLE (Live Chat)
-- =============================================
CREATE TABLE IF NOT EXISTS session_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_messages_session ON session_messages(session_id);

-- =============================================
-- 12b. SESSION VIEWERS TABLE (Who's watching)
-- =============================================
CREATE TABLE IF NOT EXISTS session_viewers (
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_session_viewers_session ON session_viewers(session_id);

-- =============================================
-- 12c. SESSION REMINDERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS session_reminders (
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (session_id, user_id)
);

-- =============================================
-- 13. BOOKMARKS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- =============================================
-- 14. FOLLOWS TABLE (one-way, public)
-- =============================================
CREATE TABLE IF NOT EXISTS follows (
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- =============================================
-- 14b. DAILY ACTIVITY TABLE (streaks)
-- =============================================
CREATE TABLE IF NOT EXISTS daily_activity (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  activity_types TEXT[] DEFAULT '{}',
  PRIMARY KEY (user_id, activity_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_activity_user ON daily_activity(user_id);

-- =============================================
-- 16. ROOM RESOURCES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS room_resources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  resource_type TEXT DEFAULT 'link' CHECK (resource_type IN ('link', 'document', 'video', 'other')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_resources_room ON room_resources(room_id);

-- =============================================
-- 17. NOTIFICATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('mate_request', 'mate_accepted', 'room_message', 'post_like', 'session_live', 'new_follower')),
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- =============================================
-- REPORTS TABLE (admin moderation)
-- =============================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('post', 'message', 'user', 'room')),
  content_id UUID,
  content_text TEXT,
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reported_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mate_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES: PROFILES
-- =============================================
-- Anyone can view profiles
CREATE POLICY "Profiles are publicly readable"
  ON profiles FOR SELECT
  USING (true);

-- Users can insert their own profile (needed for upsert from onboarding)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =============================================
-- RLS POLICIES: POSTS
-- =============================================
-- Anyone can view posts
CREATE POLICY "Posts are publicly readable"
  ON posts FOR SELECT
  USING (true);

-- Users can create their own posts
CREATE POLICY "Users can create own posts"
  ON posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- Users can update their own posts
CREATE POLICY "Users can update own posts"
  ON posts FOR UPDATE
  USING (auth.uid() = author_id);

-- Users can delete their own posts
CREATE POLICY "Users can delete own posts"
  ON posts FOR DELETE
  USING (auth.uid() = author_id);

-- =============================================
-- RLS POLICIES: POST LIKES
-- =============================================
-- Anyone can view likes
CREATE POLICY "Likes are publicly readable"
  ON post_likes FOR SELECT
  USING (true);

-- Users can like posts
CREATE POLICY "Users can like posts"
  ON post_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can unlike posts
CREATE POLICY "Users can unlike posts"
  ON post_likes FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- RLS POLICIES: COMMENTS
-- =============================================
-- Anyone can view comments
CREATE POLICY "Comments are publicly readable"
  ON comments FOR SELECT
  USING (true);

-- Users can create comments
CREATE POLICY "Users can create comments"
  ON comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- RLS POLICIES: FOLLOWS
-- =============================================
-- Anyone can view follows
CREATE POLICY "Follows are publicly readable"
  ON follows FOR SELECT
  USING (true);

-- Users can follow others
CREATE POLICY "Users can follow others"
  ON follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

-- Users can unfollow
CREATE POLICY "Users can unfollow"
  ON follows FOR DELETE
  USING (auth.uid() = follower_id);

-- =============================================
-- RLS POLICIES: DAILY ACTIVITY
-- =============================================
-- Anyone can view activity (for profile streak displays)
CREATE POLICY "Activity is publicly readable"
  ON daily_activity FOR SELECT
  USING (true);

-- Users can insert/update their own activity
CREATE POLICY "Users can insert own activity"
  ON daily_activity FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activity"
  ON daily_activity FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- RLS POLICIES: MATE REQUESTS
-- =============================================
-- Only sender and receiver can view
CREATE POLICY "Mate requests visible to sender and receiver"
  ON mate_requests FOR SELECT
  USING (auth.uid() = from_user OR auth.uid() = to_user);

-- Users can send requests
CREATE POLICY "Users can send mate requests"
  ON mate_requests FOR INSERT
  WITH CHECK (auth.uid() = from_user);

-- Receiver can update (accept/decline)
CREATE POLICY "Receiver can update mate requests"
  ON mate_requests FOR UPDATE
  USING (auth.uid() = to_user);

-- Sender can delete their request
CREATE POLICY "Sender can delete mate requests"
  ON mate_requests FOR DELETE
  USING (auth.uid() = from_user);

-- =============================================
-- RLS POLICIES: CONNECTIONS
-- =============================================
-- Users can see their own connections
CREATE POLICY "Users can view own connections"
  ON connections FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- System creates connections (via function)
CREATE POLICY "Users can create connections"
  ON connections FOR INSERT
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Users can remove their connections
CREATE POLICY "Users can delete own connections"
  ON connections FOR DELETE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- =============================================
-- RLS POLICIES: ROOMS
-- =============================================
-- All rooms are readable (public rooms are the default)
CREATE POLICY "Rooms are readable"
  ON rooms FOR SELECT
  USING (true);

-- Users can create rooms
CREATE POLICY "Users can create rooms"
  ON rooms FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Room creator can update
CREATE POLICY "Creator can update rooms"
  ON rooms FOR UPDATE
  USING (auth.uid() = created_by);

-- Room creator can delete
CREATE POLICY "Creator can delete rooms"
  ON rooms FOR DELETE
  USING (auth.uid() = created_by);

-- =============================================
-- RLS POLICIES: ROOM MEMBERS
-- =============================================
-- Room members are readable by any authenticated user
CREATE POLICY "Room members visible to members"
  ON room_members FOR SELECT
  USING (true);

-- Users can join rooms
CREATE POLICY "Users can join rooms"
  ON room_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can leave rooms
CREATE POLICY "Users can leave rooms"
  ON room_members FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- RLS POLICIES: ROOM PINS
-- =============================================
ALTER TABLE room_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room pins are readable"
  ON room_pins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create pins"
  ON room_pins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own pins"
  ON room_pins FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- RLS POLICIES: ROOM MESSAGES
-- =============================================
-- Room messages visible to members
CREATE POLICY "Room messages visible to members"
  ON room_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = room_messages.room_id
      AND room_members.user_id = auth.uid()
    )
  );

-- Members can send messages
CREATE POLICY "Members can send room messages"
  ON room_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = room_messages.room_id
      AND room_members.user_id = auth.uid()
    )
  );

-- Users can delete their own messages
CREATE POLICY "Users can delete own room messages"
  ON room_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Room admins can update messages (pin/unpin)
CREATE POLICY "Admins can update room messages"
  ON room_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = room_messages.room_id
      AND room_members.user_id = auth.uid()
      AND room_members.role IN ('admin', 'moderator')
    )
    OR auth.uid() = user_id
  );

-- =============================================
-- RLS POLICIES: DIRECT MESSAGES
-- =============================================
-- Only sender and receiver can view
CREATE POLICY "DMs visible to participants"
  ON direct_messages FOR SELECT
  USING (auth.uid() = from_user OR auth.uid() = to_user);

-- Users can send DMs
CREATE POLICY "Users can send DMs"
  ON direct_messages FOR INSERT
  WITH CHECK (auth.uid() = from_user);

-- Receiver can mark as read
CREATE POLICY "Users can update DMs"
  ON direct_messages FOR UPDATE
  USING (auth.uid() = from_user OR auth.uid() = to_user);

-- Sender can delete
CREATE POLICY "Users can delete own DMs"
  ON direct_messages FOR DELETE
  USING (auth.uid() = from_user);

-- =============================================
-- RLS POLICIES: SESSIONS
-- =============================================
-- Public sessions are visible to all
CREATE POLICY "Sessions are publicly readable"
  ON sessions FOR SELECT
  USING (true);

-- Hosts can create sessions
CREATE POLICY "Users can create sessions"
  ON sessions FOR INSERT
  WITH CHECK (auth.uid() = host_id);

-- Hosts can update their sessions
CREATE POLICY "Hosts can update sessions"
  ON sessions FOR UPDATE
  USING (auth.uid() = host_id);

-- Hosts can delete their sessions
CREATE POLICY "Hosts can delete sessions"
  ON sessions FOR DELETE
  USING (auth.uid() = host_id);

-- =============================================
-- RLS POLICIES: SESSION MESSAGES
-- =============================================
-- Session messages are publicly readable (live chat)
CREATE POLICY "Session messages are publicly readable"
  ON session_messages FOR SELECT
  USING (true);

-- Users can send session messages
CREATE POLICY "Users can send session messages"
  ON session_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own messages
CREATE POLICY "Users can delete own session messages"
  ON session_messages FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- RLS POLICIES: SESSION VIEWERS
-- =============================================
-- Anyone can see who is viewing
CREATE POLICY "Session viewers are publicly readable"
  ON session_viewers FOR SELECT
  USING (true);

-- Authenticated users can join as viewer
CREATE POLICY "Users can join as viewer"
  ON session_viewers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can leave
CREATE POLICY "Users can leave sessions"
  ON session_viewers FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- RLS POLICIES: SESSION REMINDERS
-- =============================================
-- Users can see their own reminders
CREATE POLICY "Users can view own reminders"
  ON session_reminders FOR SELECT
  USING (auth.uid() = user_id);

-- Users can set reminders
CREATE POLICY "Users can set reminders"
  ON session_reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove reminders
CREATE POLICY "Users can remove reminders"
  ON session_reminders FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- RLS POLICIES: BOOKMARKS
-- =============================================
-- Users can see their own bookmarks
CREATE POLICY "Users can view own bookmarks"
  ON bookmarks FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create bookmarks
CREATE POLICY "Users can create bookmarks"
  ON bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete bookmarks
CREATE POLICY "Users can delete bookmarks"
  ON bookmarks FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- RLS POLICIES: ROOM RESOURCES
-- =============================================
-- Room resources visible to members
CREATE POLICY "Room resources visible to members"
  ON room_resources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = room_resources.room_id
      AND room_members.user_id = auth.uid()
    )
  );

-- Members can add resources
CREATE POLICY "Members can add room resources"
  ON room_resources FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = room_resources.room_id
      AND room_members.user_id = auth.uid()
    )
  );

-- Resource owner or room creator can delete
CREATE POLICY "Resource owner can delete"
  ON room_resources FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = room_resources.room_id
      AND rooms.created_by = auth.uid()
    )
  );

-- =============================================
-- RLS POLICIES: NOTIFICATIONS
-- =============================================
-- Users can only view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- System/triggers can insert notifications (using service role)
-- For client-side inserts, user must be authenticated
CREATE POLICY "Authenticated users can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- =============================================
-- RLS POLICIES: REPORTS
-- =============================================
-- Admins can view all reports
CREATE POLICY "Admins can view all reports"
  ON reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Authenticated users can create reports
CREATE POLICY "Users can create reports"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- Admins can update reports (review/dismiss)
CREATE POLICY "Admins can update reports"
  ON reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Admins can delete reports
CREATE POLICY "Admins can delete reports"
  ON reports FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to accept mate request and create connection
CREATE OR REPLACE FUNCTION accept_mate_request(request_id UUID)
RETURNS VOID AS $$
DECLARE
  req RECORD;
BEGIN
  -- Get the request
  SELECT * INTO req FROM mate_requests WHERE id = request_id;
  
  IF req IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  
  IF req.to_user != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  -- Update request status
  UPDATE mate_requests SET status = 'accepted' WHERE id = request_id;
  
  -- Create connection (ensure consistent ordering)
  INSERT INTO connections (user1_id, user2_id)
  VALUES (
    LEAST(req.from_user, req.to_user),
    GREATEST(req.from_user, req.to_user)
  )
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get or create DM conversation between two users
CREATE OR REPLACE FUNCTION get_conversation_partner(other_user_id UUID)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  avatar_url TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.avatar_url,
    (
      SELECT dm.content 
      FROM direct_messages dm 
      WHERE (dm.from_user = auth.uid() AND dm.to_user = other_user_id)
         OR (dm.from_user = other_user_id AND dm.to_user = auth.uid())
      ORDER BY dm.created_at DESC 
      LIMIT 1
    ) as last_message,
    (
      SELECT dm.created_at 
      FROM direct_messages dm 
      WHERE (dm.from_user = auth.uid() AND dm.to_user = other_user_id)
         OR (dm.from_user = other_user_id AND dm.to_user = auth.uid())
      ORDER BY dm.created_at DESC 
      LIMIT 1
    ) as last_message_at,
    (
      SELECT COUNT(*) 
      FROM direct_messages dm 
      WHERE dm.from_user = other_user_id 
        AND dm.to_user = auth.uid() 
        AND dm.read = false
    ) as unread_count
  FROM profiles p
  WHERE p.id = other_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- STORAGE BUCKETS
-- =============================================
-- Run these in the Storage section of Supabase Dashboard
-- or use the following SQL:

INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('avatars', 'avatars', true),
  ('posts', 'posts', true),
  ('messages', 'messages', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: allow authenticated users to upload to avatars bucket
CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update own avatars"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own avatars"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =============================================
-- REALTIME SUBSCRIPTIONS
-- =============================================
-- Enable realtime for these tables (run in SQL editor):

ALTER PUBLICATION supabase_realtime ADD TABLE room_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE session_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE session_viewers;
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE mate_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- =============================================
-- DONE! Schema created successfully.
-- =============================================
