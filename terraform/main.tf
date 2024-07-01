resource "aws_instance" "quiz_app" {
  ami           = "ami-0d2f6341ccecfd1b2"
  instance_type = "t2.micro"
  key_name      = "quiz-app-key-pair"  # Ensure this matches the key pair name in AWS

  tags = {
    Name = "QuizAppInstance"
  }
}