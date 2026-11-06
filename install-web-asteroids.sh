#!/bin/bash

#unzip asteroids-web-enhanced.zip

# create web server directory
sudo mkdir -p /opt/asteroids-web || exit 1

# copy in public files and set ownship
sudo cp -a public /opt/asteroids-web/
sudo chown -R root:root /opt/asteroids-web
sudo chmod -R a=rX /opt/asteroids-web

# setup service
sudo useradd --system --user-group --no-create-home --shell /sbin/nologin asteroids
sudo cp systemd/asteroids-web.service /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now asteroids-web
