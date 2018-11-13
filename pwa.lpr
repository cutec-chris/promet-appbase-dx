program pwa;
  uses js, web, pwa_helper;

var
  cache_name : string = 'avamm-cache';
  Updater : TPWAUpdater;

var precacheFiles : array of string = (
    'index.html',
    './', // Alias for index.html
    'index.css',
    'manifest.json',
    'appbase/appbase.js',
    'appbase/startpage.js',
    'appbase/dhtmlx/dhtmlx.js',
    'appbase/dhtmlx/dhtmlx.css',
    'appbase/dhtmlx/fonts/font_awesome/css/font-awesome.min.css',
    'appbase/images/world_icon144.png',
    'appbase/images/world_icon192.png'
    );

begin
  Updater := TPWAUpdater.Create(precacheFiles);
end.
