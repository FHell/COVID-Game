## This file mostly tests certain thresholds for performance optimization of our distributions

using Distributions
using Plots

##

function mean_std(r, p)
  r * p / (1 - p), sqrt(r * p) / (1 - p)
end

function samples(r, p; N = 100000)
  r_nb = rand(NegativeBinomial(r, 1 - p), N) # The definition of NegativeBinomial differs from the Wikipedia one
  r_n = rand(Normal(mean_std(r, p)...), N)
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
r_nb, r_n, r_n_int = samples(100, 0.25)

h_nb, h_n = (r_nb, r_n_int) .|> histo


##


plot(h_nb)
plot!(h_n)
##
