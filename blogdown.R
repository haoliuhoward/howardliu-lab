# blogdown::hugo_build(local=TRUE)
blogdown::build_site()
blogdown::serve_site()

# Let's check hugo version
blogdown::check_hugo()

# [TODO] Use blogdown::config_Rprofile() to create .Rprofile for the current project.
blogdown::config_Rprofile()

# check netlify version
blogdown::check_netlify()

# # now I see they are not matched. Update Hugo to match 
# blogdown::install_hugo("0.71.0")
# options(blogdown.hugo.version = "0.109.0")
