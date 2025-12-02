FROM node:20-alpine

WORKDIR /app

# Install dependencies based on the package files
COPY package*.json ./
RUN npm ci

# Copy application files
COPY . .

# Expose port 3000
EXPOSE 3000

# Start the development server with hot reload
# Note: Prisma generate and migrate are run in docker-compose.yml command
CMD ["npm", "run", "dev"]
