unit pwa_helper;

{$mode objfpc}{$H+}

interface

uses
  Classes, SysUtils;

type

  { TPWAUpdater }

  TPWAUpdater = class
  public
    constructor Create(Files : array of String);
  end;

  TPWANotifier = class

  end;

implementation

{ TPWAUpdater }

constructor TPWAUpdater.Create(Files: array of String);
begin

end;

end.

