# Dockerfile
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the code
COPY . .

# Expose app port
EXPOSE 8000

# Start app
CMD ["npm", "start"]
