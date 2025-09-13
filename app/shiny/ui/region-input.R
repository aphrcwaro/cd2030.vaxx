regionInputUI <- function(id, i18n) {
  ns <- NS(id)

  uiOutput(ns('region_ui'))
}

regionInputServer <- function(id, cache, admin_level, i18n, allow_select_all = FALSE, show_district = TRUE, show_region = TRUE, selected_region = reactive(NULL)) {
  stopifnot(is.reactive(cache))
  stopifnot(is.reactive(admin_level))
  stopifnot(is.reactive(selected_region))

  moduleServer(
    id = id,
    module = function(input, output, session) {
      ns <- session$ns

      created <- reactiveVal(FALSE)

      show_select <- reactive({
        req(admin_level())
        switch (
          admin_level(),
          national = FALSE,
          adminlevel_1 = show_region,
          district = show_district,
          TRUE
        )
      })

      output$region_ui <- renderUI({
        req(admin_level())
        if (show_select()) {
          select_input <- selectizeInput(
            ns('region'),
            label = i18n$t('opt_admin_level_1'),
            choices = NULL
          )
          created(TRUE)
          return(select_input)
        } else {
          created(FALSE)
          return(NULL)
        }
      })

      data <- reactive({
        req(cache())
        cache()$countdown_data
      })

      region <- reactive({
       if (
          admin_level() == 'national' ||
          !isTruthy(input$region) ||
          (allow_select_all && input$region == '_all_') ||
          (admin_level() == 'adminlevel_1' && !show_region) ||
          (admin_level() == 'district' && !show_district)
        ) {
          NULL
        }
        else {
          input$region
        }
      })

      observeEvent(c(created(), admin_level()), {
        req(data(), created(), admin_level() %in% c('adminlevel_1', 'district'))

        admin_col <- admin_level()

        # Determine optgroup column conditionally
        use_optgroup <- admin_col == 'district'
        group_col <- if (use_optgroup) 'adminlevel_1' else NULL

        # Prepare data with value, label, and optional optgroup
        region_data <- data() %>%
          filter(if (!is.null(selected_region())) adminlevel_1 == selected_region() else TRUE) %>%
          distinct(!!sym(admin_col), .keep_all = TRUE) %>%
          arrange(!!sym(admin_col)) %>%
          mutate(
            value = !!sym(admin_col),
            label = !!sym(admin_col),
            optgroup = if (use_optgroup) adminlevel_1 else NA
          ) %>%
          select(value, label, optgroup)

        if (allow_select_all) {
          region_data <- bind_rows(
            tibble(
              value = '_all_',
              label = i18n$t('opt_select_all'),
              optgroup = if (use_optgroup) NA else NULL
            ),
            region_data
          )
        }

        # Convert to list of lists (rows)
        options_list <- region_data %>% pmap(~ list(...))

        # Unique optgroup labels (if used)
        optgroups_list <- if (use_optgroup) {
          region_data %>%
            distinct(optgroup) %>%
            drop_na() %>%
            transmute(value = optgroup, label = optgroup) %>%
            pmap(~ list(...))
        } else NULL

        # UI label
        label <- if (admin_col == 'district') i18n$t('opt_district') else i18n$t('opt_admin_level_1')

        # Update selectize input
        updateSelectizeInput(
          session,
          inputId = 'region',
          choices = NULL,
          selected = options_list[[1]]$value,
          label = label,
          options = list(
            options = options_list,
            optgroups = optgroups_list,
            valueField = 'value',
            labelField = 'label',
            optgroupField = if (use_optgroup) 'optgroup' else NULL,
            placeholder = i18n$t('msg_select_region')
          )
        )
      })

      return(region)
    }
  )
}
