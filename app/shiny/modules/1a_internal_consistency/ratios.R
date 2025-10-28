calculateRatiosUI <- function(id, i18n) {
  ns <- NS(id)
  
  box(
    title = i18n$t("title_ratio_plots"),
    status = 'success',
    width = 12,
    fluidRow(
      column(12, plotCustomOutput(ns('ratios_plot'))),
      column(4, downloadButtonUI(ns('ratio_plot_download')))
    )
  )
}

calculateRatiosServer <- function(id, cache, i18n) {
  stopifnot(is.reactive(cache))

  moduleServer(
    id = id,
    module = function(input, output, session) {

      ratio_summary <- reactive({
        req(cache(), all(!is.na(cache()$survey_estimates[c('anc1', 'penta1', 'penta3', 'opv1', 'opv3')])))
        calculate_ratios_summary(cache()$countdown_data,
                                 survey_coverage = cache()$survey_estimates)
      })

      output$ratios_plot <- renderCustomPlot({
        req(ratio_summary())
        plot(ratio_summary())
      })

      downloadPlot(
        id = 'ratio_plot_download',
        filename = reactive('ratio_plot'),
        data = ratio_summary,
        i18n = i18n,
        plot_function = function(data) {
          plot(data)
        }
      )
    }
  )
}
