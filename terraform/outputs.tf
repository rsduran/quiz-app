output "instance_id" {
  value = aws_instance.quiz_app.id
}

output "instance_public_ip" {
  value = aws_instance.quiz_app.public_ip
}