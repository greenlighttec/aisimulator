# backend/Dockerfile

FROM python:3.11-slim

# Set working directory inside container
WORKDIR /app

# Install dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code
COPY . .

# Expose the Flask port
EXPOSE 5000

# Set environment variable for Flask to find app
ENV FLASK_APP=ai_server.py
ENV FLASK_RUN_HOST=0.0.0.0
ENV FLASK_RUN_PORT=5000

# Start the Flask server
CMD ["flask", "run"]
