-- Run automatically by postgres on first start (docker-entrypoint-initdb.d)
-- Creates the gitea database owned by the same crucible user

CREATE DATABASE gitea OWNER crucible;
