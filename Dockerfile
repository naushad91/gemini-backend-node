# Use Node.js LTS image
FROM node:18

# Create app directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Run Prisma migrations at build time
RUN npx prisma generate

# Expose backend port
EXPOSE 8000

# Start server
CMD ["node", "src/index.js"]
