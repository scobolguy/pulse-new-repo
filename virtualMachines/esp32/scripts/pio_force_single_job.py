Import("env")

# Reduce parallel compilation for this environment to avoid intermittent
# dependency-file creation races on some Windows setups.
env.SetOption("num_jobs", 1)
