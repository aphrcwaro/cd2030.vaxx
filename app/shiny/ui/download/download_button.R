downloadButtonUI <- function(id) {
  ns <- NS(id)

  dep <- htmlDependency(
    name = "download-button",
    version = "0.1.0",
    src = c(href = "downloadbtn"),      # www/downloadbtn/download-button.js
    script = "download-button.js"
  )

  uiOutput(ns("download_ui")) %>%  
    attachDependencies(dep, append = TRUE)
}

downloadButtonServer <- function(id, filename, extension, content, data, i18n, label = "msg_download", message = "msg_downloading") {
  stopifnot(is.reactive(data), is.reactive(filename), is.reactive(extension))

  moduleServer(id, function(input, output, session) {
    ns <- session$ns

    check_data <- reactive({
      tryCatch(data(), error = function(e) NULL)
    })

    output$download_ui <- renderUI({
      req(check_data())
      downloadButton(
        ns("download_button"),
        label = i18n$t(label),
        icon  = NULL,
        class = "btn btn-default btn-flat w-100",
        style = "margin-top:10px"
      )
    })

    output$download_button <- downloadHandler(
      filename = function() {
        paste0(filename(), "_", format(Sys.time(), "%Y%m%d%H%M"), ".", extension())
      },
      content = function(file) {
        session$sendCustomMessage(
          "starting_download",
          list(id = ns("download_button"), message = i18n$t(message), label = i18n$t(label))
        )

        # ensure UI resets even on error
        on.exit({
          session$sendCustomMessage(
            "end_download",
            list(id = ns("download_button"), label = i18n$t(label))
          )
        }, add = TRUE)

        content(file, check_data())
      }
    )
  })
}
