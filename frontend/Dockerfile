# Build stage with nginx
FROM nginx:alpine

# Copy frontend files to nginx html directory
COPY *.html /usr/share/nginx/html/
COPY *.css /usr/share/nginx/html/
COPY *.js /usr/share/nginx/html/

# Remove ALL default nginx configs and copy our custom configuration
RUN rm -f /etc/nginx/conf.d/*.conf
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Verify nginx config is valid
RUN nginx -t

# Expose port
EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8081/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
