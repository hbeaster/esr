# syntax=docker/dockerfile:1
FROM node:22-alpine AS frontend
WORKDIR /source
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY vite.config.ts tsconfig.json index.html ./
COPY src ./src
COPY host ./host
RUN npm run build:host

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend
WORKDIR /source
COPY backend/Esr.Api/Esr.Api.csproj backend/Esr.Api/
RUN dotnet restore backend/Esr.Api/Esr.Api.csproj
COPY backend/Esr.Api/ backend/Esr.Api/
COPY --from=frontend /source/dist/host/ backend/Esr.Api/wwwroot/
RUN dotnet publish backend/Esr.Api/Esr.Api.csproj --no-restore -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=backend /app/publish .
ENV ASPNETCORE_HTTP_PORTS=8080 DOTNET_EnableDiagnostics=0
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "Esr.Api.dll"]
