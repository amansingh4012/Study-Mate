# StudyMate

A real-time collaborative study platform that connects students with study partners, group rooms, live sessions, and direct messaging -- all built with a modern React stack and powered by Supabase.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Install Dependencies](#2-install-dependencies)
  - [3. Configure Environment Variables](#3-configure-environment-variables)
  - [4. Set Up the Database](#4-set-up-the-database)
  - [5. Run the Development Server](#5-run-the-development-server)
- [Database Schema](#database-schema)
- [Deployment](#deployment)
- [Environment Variables Reference](#environment-variables-reference)
- [License](#license)

---

## Overview

StudyMate is designed to help students find compatible study partners, collaborate in real-time study rooms, host or join live video study sessions, and communicate through direct messaging. It features a social feed, notification system, and user profiles with study preferences -- creating a focused academic networking experience.

---

## Features

### Find a Study Mate
- Browse student profiles filtered by subject, study style, and availability.
- Send and receive mate requests with optional notes.
- Build a network of study connections.

### Social Feed
- Create posts tagged by subject with optional image uploads.
- Like, comment on, and bookmark posts.
- Subject-based filtering and infinite scroll pagination.

### Study Rooms
- Join pre-configured public focus rooms (Deep Focus, Chill Study Lounge, Exam Prep HQ, Late Night Grind).
- Real-time group chat within rooms.
- Live presence tracking showing active users per room.
- Pin messages and member management with role-based access (admin, moderator, member).

### Live Study Sessions
- Host or join live video study sessions powered by Agora RTC.
- Schedule upcoming sessions or go live immediately.
- Real-time session chat, viewer tracking, and session reminders.
- Configurable chat controls (everyone, followers-only, disabled).

### Direct Messaging
- One-on-one messaging with connected study mates.
- Image attachments, read receipts, and online presence indicators.
- Real-time message delivery via Supabase Realtime.

### Notifications
- In-app notifications for mate requests, accepted connections, post likes, room messages, and live sessions.
- Unread count badge and mark-as-read functionality.

### User Profiles
- Customizable profiles with avatar, bio, university, subjects, study style, goals, and availability.
- Guided onboarding flow for new users.
- View other users' profiles and their study preferences.

---

## Tech Stack

| Layer          | Technology                                                      |
| -------------- | --------------------------------------------------------------- |
| Framework      | React 19 with React Router v7                                   |
| Build Tool     | Vite 7                                                          |
| Styling        | Tailwind CSS 3.4                                                |
| Icons          | Lucide React                                                    |
| Backend / BaaS | Supabase (PostgreSQL, Auth, Storage, Realtime, Row Level Security) |
| Video / RTC    | Agora RTC SDK                                                   |
| Deployment     | Vercel                                                          |

---

## Project Structure

```
study-mate/
├── index.html                  # Entry HTML with Google Fonts (Syne, DM Sans)
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── vercel.json                 # SPA rewrite rules for Vercel
├── public/
├── supabase/
│   └── schema.sql              # Full database schema, RLS policies, and seed data
└── src/
    ├── main.jsx                # App entry point
    ├── App.jsx                 # Route definitions
    ├── index.css               # Tailwind directives and global styles
    ├── context/
    │   └── AuthContext.jsx     # Authentication state provider
    ├── hooks/
    │   ├── useAuth.js          # Auth context consumer hook
    │   └── useAgora.js         # Agora RTC video/audio hook
    ├── lib/
    │   └── supabase.js         # Supabase client initialization
    ├── components/
    │   ├── layout/
    │   │   ├── MainLayout.jsx      # App shell with navigation
    │   │   ├── ProtectedRoute.jsx  # Auth guard wrapper
    │   │   ├── ErrorBoundary.jsx   # React error boundary
    │   │   └── NotificationBell.jsx
    │   └── ui/
    │       ├── PostCard.jsx        # Feed post component
    │       ├── CreatePost.jsx      # Post creation form
    │       ├── MateCard.jsx        # Study mate profile card
    │       ├── RoomCard.jsx        # Room listing card
    │       ├── VideoGrid.jsx       # Session video layout
    │       ├── VideoTile.jsx       # Individual video tile
    │       ├── VideoControls.jsx   # Camera/mic controls
    │       ├── Skeletons.jsx       # Loading skeleton components
    │       ├── EmptyState.jsx      # Empty state illustrations
    │       └── Toast.jsx           # Toast notification component
    └── pages/
        ├── Signup.jsx
        ├── Login.jsx
        ├── Onboarding.jsx
        ├── Home.jsx            # Social feed with sidebar widgets
        ├── FindMate.jsx        # Browse and connect with study partners
        ├── Rooms.jsx           # Study room listing
        ├── RoomDetail.jsx      # Room chat and members
        ├── Sessions.jsx        # Live session listing and creation
        ├── SessionRoom.jsx     # Live video session with chat
        ├── Messages.jsx        # Direct message conversations
        └── Profile.jsx         # User profile view and edit
```

---

## Prerequisites

- **Node.js** >= 18
- **npm** or **yarn**
- A **Supabase** project ([supabase.com](https://supabase.com))
- An **Agora** account with an App ID ([console.agora.io](https://console.agora.io))

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/study-mate.git
cd study-mate
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with the following values:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_AGORA_APP_ID=your-agora-app-id
```

### 4. Set Up the Database

1. Open your Supabase project dashboard.
2. Navigate to the **SQL Editor**.
3. Paste the contents of `supabase/schema.sql` and run the query.

This will create all required tables, indexes, Row Level Security policies, helper functions, storage buckets, and seed data for the default study rooms.

### 5. Run the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173` by default.

---

## Database Schema

The schema includes the following tables:

| Table               | Purpose                                       |
| ------------------- | --------------------------------------------- |
| `profiles`          | Extended user profiles linked to Supabase Auth |
| `posts`             | Social feed posts                              |
| `post_likes`        | Post like tracking                             |
| `comments`          | Post comments                                  |
| `mate_requests`     | Study partner connection requests              |
| `connections`       | Accepted study mate connections                |
| `rooms`             | Study rooms (public/private)                   |
| `room_members`      | Room membership and roles                      |
| `room_messages`     | Real-time room chat messages                   |
| `room_pins`         | Pinned users within rooms                      |
| `direct_messages`   | One-on-one messages between connected users    |
| `sessions`          | Live study sessions (upcoming/live/ended)      |
| `session_messages`  | Live session chat                              |
| `session_viewers`   | Active session viewer tracking                 |
| `session_reminders` | User reminders for upcoming sessions           |
| `bookmarks`         | Saved/bookmarked posts                         |
| `notifications`     | In-app notification system                     |

All tables are secured with Row Level Security policies. Realtime subscriptions are enabled for `room_messages`, `direct_messages`, `session_messages`, `session_viewers`, `sessions`, `mate_requests`, and `notifications`.

---

## Deployment

The project includes a `vercel.json` configuration for deployment on [Vercel](https://vercel.com):

1. Push your repository to GitHub.
2. Import the project in the Vercel dashboard.
3. Add the required environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AGORA_APP_ID`) in **Settings > Environment Variables**.
4. Deploy.

The SPA rewrite rule in `vercel.json` ensures client-side routing works correctly.

---

## Environment Variables Reference

| Variable                 | Required | Description                            |
| ------------------------ | -------- | -------------------------------------- |
| `VITE_SUPABASE_URL`      | Yes      | Your Supabase project URL              |
| `VITE_SUPABASE_ANON_KEY` | Yes      | Your Supabase anonymous/public API key |
| `VITE_AGORA_APP_ID`      | Yes      | Your Agora.io application ID           |

---

## License

This project is open source. See the [LICENSE](LICENSE) file for details.
