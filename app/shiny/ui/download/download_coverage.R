downloadCoverageUI <- function(id) {
  ns <- NS(id)
  fluidRow(
    column(12, plotCustomOutput(ns('display'))),
    column(3, downloadButtonUI(ns('plot'))),
    column(3, downloadButtonUI(ns('data')))
  )
}

downloadCoverageServer <- function(id, filename, data_fn, ..., sheet_name, i18n) {
  stopifnot(is.reactive(data_fn))
  stopifnot(is.reactive(filename))
  stopifnot(is.reactive(sheet_name))

  moduleServer(
    id = id,
    module = function(input, output, session) {

      output$display <- renderCustomPlot({
        req(data_fn())
        plot(data_fn(), ...)
      })

      downloadPlot(
        id = 'plot',
        filename = filename,
        data = data_fn,
        i18n = i18n,
        plot_function = function(data) {
          plot(data, ...)
        }
      )

      downloadExcel(
        id = 'data',
        filename = filename,
        data = data_fn,
        i18n = i18n,
        excel_write_function = function(wb, data) {
          dt <- data %>%
            select(-any_of('geometry'))
          addWorksheet(wb, sheet_name())
          writeData(wb, sheet = sheet_name(), x = dt, startCol = 1, startRow = 1)
        }
      )
    }
  )

}
