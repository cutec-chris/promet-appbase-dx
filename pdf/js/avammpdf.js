var scale = 1.4; //Set this to whatever you want. This is basically the "zoom" factor for the PDF.
var PDFJS = window['pdfjs-dist/build/pdf'];
var currPage = 1;
var thePdf;

function loadPdf(pdfData) {
    currPage = 1;
    if (thePdf) thePdf.destroy();
    document.body.innerHTML = "";
    PDFJS.disableWorker = true; //Not using web workers. Not disabling results in an error. This line is
    var loadingTask = PDFJS.getDocument(pdfData);
    loadingTask.promise.then(function(pdf) {
      renderPdf(pdf);
      return loadingTask;
    }).catch(function(err){
      throw err;
    });
    return loadingTask;
}

function renderPdf(pdf) {
  pdf.getPage( currPage ).then( handlePages );
  thePdf = pdf;
}

function handlePages(page)
{
  //This gives us the page's dimensions at full scale
  var viewport = page.getViewport( scale );

  var container = document.createElement( "div" );
  
  document.body.appendChild(container);
  container.className = 'pdf-content';

  //We'll create a canvas for each page to draw it on
  var canvas = document.createElement( "canvas" );
  canvas.style.display = "block";
  var context = canvas.getContext('2d');
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  //Draw it on the canvas
  //page.render({canvasContext: context, viewport: viewport});
  container.style.height = canvas.height;
  container.style.width = canvas.width;
  container.style.position = 'relative';

  var canvasOffset = {};
  canvasOffset.top = 0;
  canvasOffset.left = 0;
  try {
    canvasOffset.top = canvas.getBoundingClientRect().top + document.body.scrollTop;
    canvasOffset.left =canvas.getBoundingClientRect().left + document.body.scrollLeft;
  } catch(e) {}

  var textLayerDiv =  document.createElement( "div" );
  textLayerDiv.className = "textLayer";
  textLayerDiv.style.height = viewport.height;
  textLayerDiv.style.width = viewport.width;
  textLayerDiv.style.top = canvasOffset.top;
  textLayerDiv.style.left = canvasOffset.left;
  container.appendChild(textLayerDiv);
  page.getTextContent().then(function (textContent) {
      var tLayer = new TextLayerBuilder(textLayerDiv, 0); //The second zero is an index identifying
      //the page. It is set to page.number - 1.
      tLayer.setTextContent(textContent);
      var renderContext = {
          canvasContext: context,
          viewport: viewport,
          textLayer: tLayer
      };
      page.render(renderContext);
  });

  //Add it to the web page
  container.appendChild( canvas );

  //Move to next page
  currPage++;
  if ( thePdf !== null && currPage <= thePdf.numPages )
  {
     thePdf.getPage( currPage ).then( handlePages );
  }
}
