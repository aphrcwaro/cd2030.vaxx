downloadButtonUI <- function(id) {
  ns <- NS(id)
  uiOutput(ns('download_ui'))
}

downloadButtonServer <- function(id, filename, extension, content, data, i18n, label = 'msg_download', message = 'msg_downloading') {
  stopifnot(is.reactive(data))
  stopifnot(is.reactive(filename))
  stopifnot(is.reactive(extension))

  moduleServer(
    id = id,
    module = function(input, output, session) {
      ns <- session$ns

      check_data <- reactive({
        tryCatch(
          data(),
          error = function(e) NULL
        )
      })

      output$download_ui <- renderUI({
        req(check_data())

        downloadButton(ns('download_button'),
                       label = i18n$t(label),
                       icon = icon(name = NULL, class = "bi bi-download"),
                       class = 'btn btn-default btn-flat',
                       style = 'width:100%;margin-top:10px;')
      })

      output$download_button <- downloadHandler(
        filename = function() {
          paste0(filename(), '_', format(Sys.time(), '%Y%m%d%H%M'), '.', extension())
        },
        content = function(file) {
          session$sendCustomMessage(
            type = 'starting_download',
            list(id = ns('download_button'), message = i18n$t(message))
          )
          content(file, check_data())
          session$sendCustomMessage(
            type = 'end_download',
            list(id = ns('download_button'), label = i18n$t(label))
          )
        }
      )
    }
  )
}
