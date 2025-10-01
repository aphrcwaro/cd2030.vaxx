consistencyCheckUI <- function(id, i18n) {
  ns <- NS(id)

  countdownDashboard(
    dashboardId =ns('consistency_checks'),
    dashboardTitle = i18n$t('title_consistency'),
    i18n = i18n,tabBox(
        title = i18n$t("title_consistency_checks"),
        width = 12,
        tabPanel(
          i18n$t("opt_anc1_and_penta1"),
          fluidRow(
            column(12, plotCustomOutput(ns('anc1_penta1'))),
            column(4, downloadButtonUI(ns('anc1_penta1_plot')))
          )
        ),
        tabPanel(
          i18n$t("opt_penta1_and_penta3"),
          fluidRow(
            column(12, plotCustomOutput(ns('penta1_penta3'))),
            column(4, downloadButtonUI(ns('penta1_penta3_plot')))
          )
        ),
        tabPanel(
          i18n$t("opt_custom_check"),
          fluidRow(
            column(3, indicatorSelect(ns('x_axis'), i18n, label = 'title_x_axis')),
            column(3, offset = 1, indicatorSelect(ns('y_axis'), i18n, label = 'title_y_axis')),
            column(12, plotCustomOutput(ns('custom_graph'))),
            column(4, downloadButtonUI(ns('custom_graph_plot')))
          )
        )
      )
  )
}

consistencyCheckServer <- function(id, cache, i18n) {
  stopifnot(is.reactive(cache))

  moduleServer(
    id = id,
    module = function(input, output, session) {
      
      x_axis <- indicatorSelectServer('x_axis', cache)
      y_axis <- indicatorSelectServer('y_axis', cache)

      data <- reactive({
        req(cache())
        cache()$countdown_data
      })

      output$anc1_penta1 <- renderCustomPlot({
        req(data())
        plot_comparison_anc1_penta1(data())
      })

      output$penta1_penta3 <- renderCustomPlot({
        req(data())
        plot_comparison_penta1_penta3(data())
      })

      output$custom_graph <- renderCustomPlot({
        req(data(), x_axis(), y_axis())
        plot_comparison(data(), x_axis(), y_axis())
      })

      downloadPlot(
        id = 'anc1_penta1_plot',
        filename = reactive('anc1_penta1_plot'),
        data = data,
        i18n = i18n,
        plot_function = function(dt) {
          plot_comparison_anc1_penta1(dt)
        }
      )

      downloadPlot(
        id = 'penta1_penta3_plot',
        filename = reactive('penta1_penta3_plot'),
        data = data,
        i18n = i18n,
        plot_function = function(dt) {
          plot_comparison_penta1_penta3(dt)
        }
      )

      downloadPlot(
        id = 'custom_graph_plot',
        filename = reactive(paste0(x_axis(), '_', y_axis(), '_plot')),
        data = data,
        i18n = i18n,
        plot_function = function(dt) {
          plot_comparison(dt, x_axis(), y_axis())
        }
      )

      countdownHeaderServer(
        'consistency_checks',
        cache = cache,
        path = 'numerator-assessment',
        section = 'sec-dqa-consistency',
        i18n = i18n
      )
    }
  )
}
