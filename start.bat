@echo off
title Trading Journal
echo.
echo  Trading Journal - Serveur local
echo  ================================
echo  URL : http://localhost:3000
echo  Fermez cette fenetre pour arreter le serveur.
echo.
start "" "http://localhost:3000"
npx --yes serve . -p 3000
