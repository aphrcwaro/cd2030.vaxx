nationalInequalityUI <- function(id, i18n) {
  ns <- NS(id)

  contentDashboard(
    dashboardId = ns('national_inequality'),
    dashboardTitle = i18n$t('title_national_inequality'),
    i18n = i18n,

    optionsHeader = contentOptions(
      title = i18n$t('title_analysis_options'),
      column(3, adminLevelInputUI(ns('admin_level'), i18n)),
      column(3, denominatorInputUI(ns('denominator'), i18n))
    ),

    tabBox(
      title = i18n$t('title_national_inequality'),
      width = 12,

      tabPanel(title = i18n$t('opt_anc4'), downloadCoverageUI(ns('anc4'))),
      tabPanel(title = i18n$t('opt_livebirths'), downloadCoverageUI(ns('livebirths'))),
      tabPanel(title = i18n$t('opt_lbw'), downloadCoverageUI(ns('lbw'))),
      tabPanel(title = i18n$t('opt_penta3'), downloadCoverageUI(ns('penta3'))),
      tabPanel(title = i18n$t('opt_mcv1'), downloadCoverageUI(ns('measles1'))),
      tabPanel(
        title = i18n$t('opt_custom_check'),
        fluidRow(
          column(3, selectizeInput(ns('indicator'), label = i18n$t('title_indicator'),
                                   choices = c('Select' = '', get_indicator_without_opd_ipd())))
        ),
        downloadCoverageUI(ns('custom'))
      )
    )
  )
}

nationalInequalityServer <- function(id, cache, i18n) {
  stopifnot(is.reactive(cache))

  moduleServer(
    id = id,
    module = function(input, output, session) {

      denominatorInputServer('denominator', cache, i18n)
      admin_level <- adminLevelInputServer('admin_level')

      inequalities <- reactive({
        req(cache(), cache()$check_inequality_params, admin_level())
        cache()$calculate_inequality(admin_level = admin_level())
      })

      anc4_inequality <- reactive({
        req(inequalities())
        inequalities() %>%
          filter_inequality(indicator = 'anc4', denominator = cache()$get_denominator('anc4'))
      })

      livebirths_inequality <- reactive({
        req(inequalities())
        inequalities() %>%
          filter_inequality(indicator = 'instlivebirths', denominator = cache()$get_denominator('instlivebirths'))
      })

      lbw_inequality <- reactive({
        req(inequalities())
        inequalities() %>%
          filter_inequality(indicator = 'low_bweight', denominator = cache()$get_denominator('low_bweight'))
      })

      penta3_inequality <- reactive({
        req(inequalities())
        inequalities() %>%
          filter_inequality(indicator = 'penta3', denominator = cache()$get_denominator('penta3'))
      })

      measles1_inequality <- reactive({
        req(inequalities())
        inequalities() %>%
          filter_inequality(indicator = 'measles1', denominator = cache()$get_denominator('measles1'))
      })

      custom_inequality <- reactive({
        req(inequalities(), input$indicator)
        inequalities() %>%
          filter_inequality(indicator = input$indicator, denominator = cache()$get_denominator(input$indicator))
      })

      downloadCoverageServer(
        id = 'anc4',
        filename = reactive(paste0('anc4_', admin_level(), '_inequality_', cache()$get_denominator('anc4'))),
        data_fn = anc4_inequality,
        i18n = i18n,
        sheet_name = reactive(i18n$t('title_anc4_inequality'))
      )

      downloadCoverageServer(
        id = 'livebirths',
        filename = reactive(paste0('livebirths_', admin_level(), '_inequality_', cache()$get_denominator('instlivebirths'))),
        data_fn = livebirths_inequality,
        i18n = i18n,
        sheet_name = reactive(i18n$t('title_livebirths_inequality'))
      )

      downloadCoverageServer(
        id = 'lbw',
        filename = reactive(paste0('lbw_', admin_level(), '_inequality_', cache()$get_denominator('low_bweight'))),
        data_fn = lbw_inequality,
        i18n = i18n,
        sheet_name = reactive(i18n$t('title_lbw_inequality'))
      )

      downloadCoverageServer(
        id = 'measles1',
        filename = reactive(paste0('measles1_', admin_level(), '_inequality_', cache()$get_denominator('measles1'))),
        data_fn = measles1_inequality,
        i18n = i18n,
        sheet_name = reactive(i18n$t('title_mcv1_inequality'))
      )

      downloadCoverageServer(
        id = 'penta3',
        filename = reactive(paste0('penta3', admin_level(), '_inequality_', cache()$get_denominator('penta3'))),
        data_fn = penta3_inequality,
        i18n = i18n,
        sheet_name = reactive(i18n$t('title_penta3_inequality'))
      )

      downloadCoverageServer(
        id = 'custom',
        filename = reactive(paste0(input$indicator, '_', admin_level(), '_inequality_', cache()$get_denominator(input$indicator))),
        data_fn = custom_inequality,
        i18n = i18n,
        sheet_name = reactive(paste0(input$indicator, ' Inequality'))
      )

      contentHeaderServer(
        'national_inequality',
        cache = cache,
        path = 'national-inequality',
        i18n = i18n
      )
    }
  )
}
