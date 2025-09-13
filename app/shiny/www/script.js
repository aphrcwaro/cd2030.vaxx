Shiny.addCustomMessageHandler("starting_download", (message) => {
  let inner_html = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>' +
  '<span class="ps-1">' + message['message'] + '</span>';
  $("#" + message["id"])
    .html(inner_html)
    .addClass('disabled')
    .attr('onclick', 'return false;')
    .css('pointer-events', 'none')
    .css('opacity', '0.6');
});

Shiny.addCustomMessageHandler("end_download", (message) => {
  let inner_html = '<i class="bi bi-download me-2"></i>' + message["label"];
  $("#" + message["id"])
    .html(inner_html)
    .removeClass("disabled")
    .css("pointer-events", "auto")
    .css("opacity", "1")
    .removeAttr("onclick");
});
