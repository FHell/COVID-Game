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
  r_nb, r_n_int
end

function histo(arr::AbstractArray{Int, 1})
  histo = zeros(Int, maximum(arr)+1)
  for a in arr
    histo[a+1] += 1
  end
  histo / sum(histo)
end

function zero_pad((a,b))
  r = zeros(eltype(a), max(length(a), length(b)))
  if length(a) > length(b)
    r[1:length(b)] .= b
    return a, r
  else
    r[1:length(a)] .= a
    return r, b
  end
end

##
r_nb, r_n_int = samples(100, 0.2)

h_nb, h_n = (r_nb, r_n_int) .|> histo |> zero_pad

##


plot(h_nb, label="neg bin")
plot!(h_n, label="normal")


##
using Statistics
distance((x,y)) = sqrt(mean((x .- y) .^ 2))
##

approx_qual = (r,p) -> samples(r, p) .|> histo |> zero_pad |> distance

##
approx_qual(100, 0.3)

ps = 0.01:0.01:0.99
rs = 5:10:200

function make_map(rs, ps, fun)
  m = zeros((length(rs), length(ps)))
  for (i, r) in enumerate(rs)
    for (j, p) in enumerate(ps)
      m[i,j] = fun(r,p)
    end
  end
  m
end

aq_map = make_map(rs, ps, approx_qual)
mean_map = make_map(rs, ps, (r,p) -> mean_std(r, p)[1])
crit_map = make_map(rs, ps, (r,p) -> r*p/(1-p) < 20. ? 1. : 0.)


##

heatmap(ps, rs, aq_map)

##

heatmap(ps, rs, mean_map)

##


scatter(aq_map, crit_map, xlims=[0,0.01], legend=false)
# The distance between the negative binomial and the normal distribution is 
# less then 0.005 for all cases looked at where r*p/(1-p) < 20.

##