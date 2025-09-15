adjustmentChangesUI <- function(id, i18n) {
  ns <- NS(id)

  countdownDashboard(
    dashboardId = ns('adjustment'),
    dashboardTitle = i18n$t('title_adjustment_changes'),
    i18n = i18n,

    include_report = TRUE,

    tabBox(
      title = i18n$t('title_visualize_changes'),
      width = 12,

      tabPanel(title = i18n$t("opt_live_births"), downloadCoverageUI(ns('live_births'))),
      tabPanel(title = i18n$t("opt_penta1"), downloadCoverageUI(ns('penta1'))),
      tabPanel(title = i18n$t("opt_bcg"), downloadCoverageUI(ns('bcg'))),
      tabPanel(title = i18n$t("opt_measles"), downloadCoverageUI(ns('measles1'))),
      tabPanel(
        title = i18n$t("opt_custom_check"),
        fluidRow(
          column(3, selectizeInput(ns('indicator'),
                                   label = i18n$t("title_indicator"),
                                   choices = c('Select Indicator' = '', get_all_indicators())))
        ),
        downloadCoverageUI(ns('custom'))
      )
    )
  )
}

adjustmentChangesServer <- function(id, cache, i18n) {
  stopifnot(is.reactive(cache))

  moduleServer(
    id = id,
    module = function(input, output, session) {

      data <- reactive({
        req(cache())
        cache()$data_with_excluded_years
      })

      k_factors <- reactive({
        req(cache())

        if (cache()$adjusted_flag) {
          cache()$k_factors
        } else {
          c(anc = 0, ideliv = 0, vacc = 0)
        }
      })

      adjustments <- reactive({
        req(data())
        data() %>%
          generate_adjustment_values(adjustment = 'custom', k_factors = k_factors())
      })
      
      livebirth_adjustments <- reactive({
        req(adjustments())
        adjustments() %>% 
          filter_adjustment_value('instlivebirths')
      })
      
      penta1_adjustments <- reactive({
        req(adjustments())
        adjustments() %>% 
          filter_adjustment_value('penta1')
      })
      
      bcg_adjustments <- reactive({
        req(adjustments())
        adjustments() %>% 
          filter_adjustment_value('bcg')
      })
      
      measles1_adjustments <- reactive({
        req(adjustments())
        adjustments() %>% 
          filter_adjustment_value('measles1')
      })
      
      custom_adjustments <- reactive({
        req(adjustments(), input$indicator)
        adjustments() %>% 
          filter_adjustment_value(input$indicator)
      })

      downloadCoverageServer(
        id = 'live_births',
        filename = reactive('live_births'),
        data_fn = livebirth_adjustments,
        title = i18n$t("figure_live_births_outlier"),
        sheet_name = reactive(i18n$t("opt_live_births")),
        i18n = i18n
      )

      downloadCoverageServer(
        id = 'penta1',
        filename = reactive('penta1'),
        data_fn = penta1_adjustments,
        title = i18n$t("figure_penta_outlier"),
        sheet_name = reactive(i18n$t("opt_penta1")),
        i18n = i18n
      )

      downloadCoverageServer(
        id = 'bcg',
        filename = reactive('bcg'),
        data_fn = bcg_adjustments,
        title = i18n$t("figure_bcg_outlier"),
        sheet_name = reactive(i18n$t("opt_bcg")),
        i18n = i18n
      )

      downloadCoverageServer(
        id = 'measles1',
        filename = reactive('measles1'),
        data_fn = measles1_adjustments,
        title = i18n$t("figure_mcv1_outlier"),
        sheet_name = reactive(i18n$t("opt_measles")),
        i18n = i18n
      )

      downloadCoverageServer(
        id = 'custom',
        filename = reactive(paste0(input$indicator, '_plot')),
        data_fn = custom_adjustments,
        sheet_name = reactive(i18n$t("opt_custom_check")),
        i18n = i18n
      )

      countdownHeaderServer(
        'adjustment',
        cache = cache,
        path = 'numerator-adjustments',
        section = 'sec-dqa-adjust-outputs',
        i18n = i18n
      )
    }
  )
}
