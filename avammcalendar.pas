unit avammcalendar;

{$mode objfpc}{$H+}

interface

uses
  Classes, SysUtils, AvammForms;

type

  { TAvammCalenderForm }

  TAvammCalenderForm = class(TAvammListForm)
  private
  public
    constructor Create(aParent : TJSElement;aDataSet : string;aPattern : string = '1C');override;
  end;

implementation

{ TAvammCalenderForm }

constructor TAvammCalenderForm.Create(aParent: TJSElement; aDataSet: string;
  aPattern: string);
begin
  inherited Create(aParent, aDataSet, aPattern);
end;

end.

