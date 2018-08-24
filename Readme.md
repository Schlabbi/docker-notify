# Docker-Notify

Docker-Notify can send you a mail when a Docker image gets updated.

## Variable Definitions
* `$CONFIG_DIR` defines the directory where the config is stored

## Setup

1. Copy the `config.json.example` file to `$CONFIG_DIR/config.json`
2. Fill out the `config.json` file:
 * Read the self describing schema in src/schema.json
 * If the tag is left out (example: user/repoName), you will receive a mail about any updates made (e.g. nightly builds)
 * If the repository is an official repository, you can leave out the user and just add repoName:tag as image.
3. Build the Docker container for `docker-notify`.
4. Set the variable `$CONFIG_DIR` in the docker-compose file.
5. Run the container with `docker-compose up -d`
6. If you editsettings in the config, you need to execute `docker-compose up` again.
