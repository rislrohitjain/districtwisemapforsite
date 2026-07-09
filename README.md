---
title: School Mapping Dashboard
emoji: 🏫
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# School Mapping Dashboard

A premium, interactive, dark-themed dashboard mapping schools from a MySQL database using Google Maps, featuring interactive side statistics tables, district-level statistics, dynamic data loading, and modal overlays.

## Features

- **Google Maps Integration**: Visualizes school coordinates with custom styling.
- **Marker Clustering**: Dynamically aggregates school locations into cluster counts.
- **Tabular Statistics**: Summarizes school count by district and provides a detailed listing.
- **Interactive Filtering**: Selecting districts or schools in the sidebar immediately pans/zooms the map, and clicking map markers focuses on corresponding records.
- **Premium Dark UI**: Built with modern CSS (glassmorphism, subtle gradients, Outfit/Inter typography, responsive panels).
- **Smooth Animations**: Animated list items, pulsing hover highlights, and modal transitions.
- **Skeleton Loader**: Modern content skeleton loading states during initial API fetch.
- **Vercel & Hugging Face Support**: Built-in configs to deploy as a Serverless function (Vercel) or a Docker container (Hugging Face Spaces).

## Setup & Running Locally

1. Clone this repository.
2. Install the Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Create a `.env` file by copying the template:
   ```bash
   cp .env.example .env
   ```
4. Edit the `.env` file and insert your MySQL credentials and Google Maps API Key:
   ```env
   DB_HOST=************
   DB_USER=************
   DB_PASSWORD=************
   DB_NAME=************
   GOOGLE_MAPS_API_KEY=your_key_here
   ```
5. Run the development server:
   ```bash
   python app.py
   ```
6. Open your browser and navigate to `http://localhost:5000`.

## Deployment

### Vercel
Connect your Git repository to Vercel. Set the following Environment Variables in the Vercel dashboard:
- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `GOOGLE_MAPS_API_KEY`

Vercel will build and serve the application automatically using `app.py` via `vercel.json`.

### Hugging Face Spaces
1. Create a new Space on Hugging Face.
2. Select **Docker** as the SDK.
3. Upload these files to the Space repository or push via Git.
4. Set your MySQL credentials and Google Maps API Key in the Hugging Face Space settings under **Variables and secrets**.
5. Hugging Face will build the container using the provided `Dockerfile` and serve the dashboard.
