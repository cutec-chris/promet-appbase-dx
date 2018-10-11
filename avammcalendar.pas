unit avammcalendar;

{$mode objfpc}{$H+}

interface

uses
  web,JS, AvammForms, dhtmlx_scheduler, Avamm;

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
  function CreateCalender(aValue: JSValue): JSValue;
  var
    aDiv: TJSElement;
  begin
    aDiv := document.createElement('div');
    aDiv.innerHTML:='<div id="scheduler_div" class="dhx_cal_container" style="width:100%; height:100%;"><div class="dhx_cal_navline"><div class="dhx_cal_prev_button">&nbsp;</div><div class="dhx_cal_next_button">&nbsp;</div><div class="dhx_cal_today_button"></div><div class="dhx_cal_date"></div><div class="dhx_cal_tab" name="day_tab" style="right:204px;"></div><div class="dhx_cal_tab" name="week_tab" style="right:140px;"></div><div class="dhx_cal_tab" name="month_tab" style="right:76px;"></div></div><div class="dhx_cal_header"></div><div class="dhx_cal_data"></div></div>';
    Page.cells('a').appendObject(aDiv);
    scheduler.init('scheduler_div',TJSDate.New,'month');
  end;
begin
  inherited Create(aParent, aDataSet, aPattern);
  Grid := nil;
  LoadScheduler;
  SchedulerLoaded._then(@CreateCalender);
end;

end.

