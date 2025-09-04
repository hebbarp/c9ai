#lang racket

;; Simple test script
(printf "Hello from Racket!\n")
(printf "Racket is working properly.\n")

;; Test web server basic functionality
(require web-server/servlet
         web-server/servlet-env)

(define (start request)
  (printf "Request received!\n")
  (response/xexpr
   `(html
     (head (title "Test"))
     (body (h1 "Hello from Racket Web Server!")
           (p "This is a test page")))))

(printf "Starting simple web server on port 8081...\n")
(serve/servlet start
               #:port 8081
               #:servlet-path "/test")