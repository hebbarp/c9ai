def nth_prime(n):
    limit = int(n * (log(n) + log(log(n))))
    sieve = [True] * limit
    count = 0
    for num in range(2, limit):
        if sieve[num]:
            count += 1
            if count == n:
                return num
            for multiple in range(num*num, limit, num):
                sieve[multiple] = False
    return -1  # In case n is larger than the limit

import math

n = int(input("Enter the value of n: "))
print(f"The {n}th prime number is: {nth_prime(n)}")