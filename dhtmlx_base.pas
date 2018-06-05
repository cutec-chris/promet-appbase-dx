unit dhtmlx_base;

{$mode objfpc}{$H+}

interface

uses
  js,Web;

var
  DHTMLXPromise : TJSPromise;

implementation

procedure AppendCSS(url : string);
begin
  asm
    var file = url;
    var link = document.createElement( "link" );
    link.href = file;
    link.type = "text/css";
    link.rel = "stylesheet";
    link.media = "screen,print";
    document.getElementsByTagName( "head" )[0].appendChild( link );
  end;
end;
procedure AppendJS(url : string;onLoad : JSValue);
begin
  asm
    var file = url;
    var link = document.createElement( "script" );
    link.src = file;
    link.type = "text/javascript";
    link.onload = onLoad;
    document.getElementsByTagName( "head" )[0].appendChild( link );
  end;
end;

procedure LoadDHTMLX;
  procedure DoLoadDHTMLX(resolve,reject : TJSPromiseResolver) ;
    procedure ScriptLoaded;
    begin
      asm
        window.dhx4.skin = 'material';
      end;
      resolve(true);
      writeln('DHTMLX loaded...');
    end;
  begin
    writeln('Loading DHTMLX...');
    AppendJS('https://cdn.dhtmlx.com/edge/dhtmlx.js',@ScriptLoaded);
    AppendCSS('https://cdn.dhtmlx.com/edge/fonts/font_awesome/css/font-awesome.min.css');
    AppendCSS('https://cdn.dhtmlx.com/edge/dhtmlx.css');
  end;
begin
  DHTMLXPromise:=TJSPromise.New(@DoLoadDHTMLX);
end;

initialization
  LoadDHTMLX;
end.

