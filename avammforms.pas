unit AvammForms;

{$mode objfpc}{$H+}

interface

uses
  Classes, SysUtils, dhtmlx_form, dhtmlx_toolbar;

type
  TAvammForm = class
  public
  end;

  { TAvammListForm }

  TAvammListForm = class
  public
    constructor Create(aDataSet : string);
    procedure RefreshList;
  end;

implementation

{ TAvammListForm }

constructor TAvammListForm.Create(aDataSet: string);
begin

end;

procedure TAvammListForm.RefreshList;
begin

end;

end.

