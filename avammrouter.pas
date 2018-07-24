unit AvammRouter;

{$mode objfpc}{$H+}

interface

uses
  Classes, SysUtils, webrouter;

type

  { TAvammRouter }

  TAvammRouter = class(TRouter)
  protected
    function DoRouteRequest(ARoute : TRoute; Const AURL : String; AParams : TStrings) : TRoute;override;
  end;

  function Router : TRouter;

resourcestring
  strRouteNotFound        = 'Das gewählt Objekt wurde nicht gwfunden, oder Sie besitzen nicht die nötigen rechte um es zu sehen !';

implementation

function Router: TRouter;
begin
  Result := TAvammRouter.Service;
end;


{ TAvammRouter }

function TAvammRouter.DoRouteRequest(ARoute: TRoute; const AURL: String;
  AParams: TStrings): TRoute;
begin
  try
    Result:=aRoute;
    if Assigned(Result) then
      Result.HandleRequest(Self,aURL,AParams)
    else if AURL<>'/' then
      raise Exception.Create(strRouteNotFound);
  except
    raise Exception.Create(strRouteNotFound);
  end;
end;

initialization
  Router.SetServiceClass(TAvammRouter);
end.

