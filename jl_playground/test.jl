## This file mostly tests certain thresholds for performance optimization of our distributions

using Distributions

##

function mean_var(r, p)
  r * p / (1 - p), r * p / (1 - p)^2
end

function samples(r, p; N = 100)
  r_nb = rand(NegativeBinomial(r, 1 - p), N) # The definition of NegativeBinomial differs from the Wikipedia one
  r_n = rand(Normal(mean_var(r, p)...), N)
  r_n_int = r_n .|> (x) -> round(Int, x) .|> (n) -> max(0, n)
  r_nb, r_n, r_n_int
end

function histo(arr::AbstractArray{Int, 1})
  histo = zeros(Int, maximum(arr)+1)
  for a in arr
    histo[a+1] += 1
  end
  histo
end

##
r_nb, r_n, r_n_int = samples(1000, 0.9)

h_nb, h_n = (r_nb, r_n_int) .|> histo


##
using Plots
##
