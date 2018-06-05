unit dhtmlx_form;

{$mode objfpc}
{$modeswitch externalclass}

interface

uses
  js,web;

type
  TForm = class external name 'dhtmlXForm' (TJSElement)
  end;

implementation

end.

