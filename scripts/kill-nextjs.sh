#!/bin/bash
pkill -9 -f "next dev"
pkill -9 -f "next-server"
lsof -ti :3000 | xargs kill -9 2>/dev/null
lsof -ti :3001 | xargs kill -9 2>/dev/null
echo "✅ All Next.js processes killed. You can now run: npm run dev"

