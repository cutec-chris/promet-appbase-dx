unit dhtmlx_base;

{$mode objfpc}{$H+}

interface

uses
  js,Web;

implementation

procedure LoadDHTMLX;
begin
  window.document.head.append('<script src="https://cdn.dhtmlx.com/edge/dhtmlx.js" type="text/javascript"></script>');
  window.document.head.append('<link rel="stylesheet" type="text/css" href="https://cdn.dhtmlx.com/edge/fonts/font_awesome/css/font-awesome.min.css"/>');
  window.document.head.append('<link rel="stylesheet" type="text/css" href="https://cdn.dhtmlx.com/edge/dhtmlx.css">');
end;

initialization
  LoadDHTMLX;
end.

